import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';

/**
 * A node whose CDN host is configured must keep that host after conversion.
 * Servers behind a CDN (Cloudflare and friends) reject the handshake when the
 * Host header disappears, and share links often carry it only as `sni`.
 */

const UUID = '12345678-1234-1234-1234-123456789abc';
const HOST = 'ag.453189070.xyz';

const vlessUrl = (query) => `vless://${UUID}@1.2.3.4:443?${query}#Node`;
const vmessUrl = (config) => 'vmess://' + Buffer.from(JSON.stringify({
    v: '2', ps: 'Node', add: '1.2.3.4', port: '443', id: UUID, aid: '0', ...config
})).toString('base64');

const buildClash = async (input) => {
    const built = await new ClashConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0').build();
    return (yaml.load(built).proxies || [])[0];
};

const buildSingbox = async (input) => {
    const built = await new SingboxConfigBuilder(input, [], [], null, 'zh-CN', null, false, false, undefined, undefined, '1.14').build();
    return (built.outbounds || []).find(outbound => outbound.server);
};

describe('websocket host header', () => {
    it('keeps an explicit host parameter in both outputs', async () => {
        const url = vlessUrl(`type=ws&host=${HOST}&path=%2Fws&security=tls&sni=${HOST}`);

        expect((await buildClash(url))['ws-opts']).toEqual({ path: '/ws', headers: { host: HOST } });
        expect((await buildSingbox(url)).transport).toEqual({ type: 'ws', path: '/ws', headers: { host: HOST } });
    });

    it('falls back to sni when the link only carries sni', async () => {
        const url = vlessUrl(`type=ws&path=%2Fws&security=tls&sni=${HOST}`);

        // this is the regression: only vmess used to fall back to sni, so
        // vless/trojan links lost the Host header and could not connect
        expect((await buildClash(url))['ws-opts']).toEqual({ path: '/ws', headers: { host: HOST } });
        expect((await buildSingbox(url)).transport).toEqual({ type: 'ws', path: '/ws', headers: { host: HOST } });
    });

    it('applies the same fallback to trojan', async () => {
        const url = `trojan://pass@1.2.3.4:443?type=ws&path=%2Fws&sni=${HOST}#Node`;

        expect((await buildClash(url))['ws-opts']).toEqual({ path: '/ws', headers: { host: HOST } });
        expect((await buildSingbox(url)).transport).toEqual({ type: 'ws', path: '/ws', headers: { host: HOST } });
    });

    it('omits the header map when the node has neither host nor sni', async () => {
        const url = vmessUrl({ net: 'ws', type: 'none', host: '', path: '/ws', tls: 'tls' });

        expect((await buildClash(url))['ws-opts']).toEqual({ path: '/ws' });
        expect((await buildSingbox(url)).transport).toEqual({ type: 'ws', path: '/ws' });
    });
});

describe('non-websocket transports keep their host', () => {
    it('maps tcp + headerType=http to the http transport', async () => {
        const url = vlessUrl(`type=tcp&headerType=http&host=${HOST}&path=%2F&security=tls&sni=${HOST}`);

        // mihomo types http-opts headers as map[string][]string
        expect((await buildClash(url))['http-opts']).toEqual({
            method: 'GET',
            path: ['/'],
            headers: { host: [HOST] }
        });
        expect((await buildSingbox(url)).transport).toEqual({
            type: 'http',
            path: '/',
            headers: { host: [HOST] }
        });
    });

    it('maps h2 to a host list instead of a header map', async () => {
        const url = vlessUrl(`type=h2&host=${HOST}&path=%2Fh2&security=tls&sni=${HOST}`);

        expect((await buildClash(url))['h2-opts']).toEqual({ path: '/h2', host: [HOST] });
        // sing-box merged h2 into the http transport
        expect((await buildSingbox(url)).transport).toEqual({ type: 'http', path: '/h2', host: [HOST] });
    });

    it('keeps httpupgrade reachable in both clients', async () => {
        const url = vlessUrl(`type=httpupgrade&host=${HOST}&path=%2Fup&security=tls&sni=${HOST}`);
        const clash = await buildClash(url);

        // mihomo treats an unknown network as tcp, httpupgrade reuses ws-opts
        expect(clash.network).toBe('ws');
        expect(clash['ws-opts']).toEqual({
            path: '/up',
            headers: { host: HOST },
            'v2ray-http-upgrade': true
        });
        // sing-box takes a plain string host here
        expect((await buildSingbox(url)).transport).toEqual({ type: 'httpupgrade', path: '/up', host: HOST });
    });

    it('emits no empty transport when the link has no type', async () => {
        const url = vlessUrl(`security=tls&sni=${HOST}`);
        const outbound = await buildSingbox(url);

        expect((await buildClash(url)).network).toBe('tcp');
        // an empty transport object makes sing-box reject the whole profile
        expect(outbound.transport).toBeUndefined();
        expect(JSON.stringify(outbound)).not.toContain('"transport"');
    });
});
