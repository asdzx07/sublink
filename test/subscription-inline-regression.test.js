import { describe, it, expect, afterEach, vi } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { encodeBase64 } from '../src/utils.js';

/**
 * A profile generated from a subscription URL used to depend on the User-Agent
 * of whoever requested it: an airport that switches format by UA answers with
 * base64 for the browser but with Clash YAML for mihomo, and the Clash builder
 * then emitted a proxy-provider instead of the nodes. The imported profile
 * showed an empty node list, while the very same link looked fine in a browser.
 */
const SUB_URL = 'https://example.com/api/v1/client/subscribe?token=abc';

const clashYaml = `proxies:
  - name: HK-01
    type: ss
    server: hk.example.com
    port: 443
    cipher: aes-128-gcm
    password: test123
  - name: JP-01
    type: ss
    server: jp.example.com
    port: 443
    cipher: aes-128-gcm
    password: test456
proxy-groups:
  - name: PROXY
    type: select
    proxies: [HK-01, JP-01]
rules:
  - MATCH,PROXY
`;

const base64Nodes = encodeBase64([
    'ss://YWVzLTEyOC1nY206dGVzdDEyMw==@hk.example.com:443#HK-01',
    'ss://YWVzLTEyOC1nY206dGVzdDEyMw==@jp.example.com:443#JP-01'
].join('\n'));

const stubFormatSwitchingAirport = () => {
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        const ua = init?.headers?.get?.('User-Agent') || '';
        const body = /clash|mihomo|meta|verge/i.test(ua) ? clashYaml : base64Nodes;
        return { ok: true, status: 200, text: async () => body, headers: { get: () => null } };
    }));
};

const buildClash = async (ua) => {
    const builder = new ClashConfigBuilder(SUB_URL, 'minimal', [], null, 'zh-CN', ua, false, false, '', '', true);
    return yaml.load(await builder.build());
};

describe('subscription URL: the generated profile never depends on the caller UA', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('inlines the same nodes whatever format the airport answers with', async () => {
        stubFormatSwitchingAirport();

        const asBrowser = await buildClash('Mozilla/5.0 (Windows NT 10.0) Chrome/120');
        const asMihomo = await buildClash('clash-verge/v2.0.3');

        [asBrowser, asMihomo].forEach(config => {
            expect(config.proxies.map(proxy => proxy.name)).toEqual(['HK-01', 'JP-01']);
            // a provider would be re-downloaded by the client with yet another
            // UA, which is exactly how the node list ended up empty
            expect(config['proxy-providers']).toBeUndefined();

            const nodeSelect = config['proxy-groups'].find(g => g.name === '🚀 节点选择');
            expect(nodeSelect.proxies).toEqual(expect.arrayContaining(['HK-01', 'JP-01']));
            expect(nodeSelect.use).toBeUndefined();
        });
    });

    it('keeps every group selectable without a provider', async () => {
        stubFormatSwitchingAirport();
        const config = await buildClash('clash-verge/v2.0.3');

        const emptyUrlTest = (config['proxy-groups'] || []).filter(group =>
            group.type === 'url-test' && (group.proxies || []).length === 0 && !group.use
        );
        expect(emptyUrlTest).toEqual([]);
    });
});

describe('pasted client configs do not leak foreign top-level keys', () => {
    const clashWithRuntimeKeys = `port: 7890
socks-port: 7891
mixed-port: 7892
allow-lan: true
mode: rule
log-level: info
unified-delay: true
tcp-concurrent: true
find-process-mode: strict
external-controller: 127.0.0.1:9090
secret: abc
geodata-mode: true
hosts:
  'x.com': 1.2.3.4
sniffer:
  enable: true
proxies:
  - name: HK-01
    type: ss
    server: hk.example.com
    port: 443
    cipher: aes-128-gcm
    password: test123
`;

    it('emits only sing-box keys when a Clash config is pasted', async () => {
        const builder = new SingboxConfigBuilder(
            clashWithRuntimeKeys,
            'minimal',
            [],
            null,
            'zh-CN',
            'sing-box/1.12.0',
            false,
            false,
            '',
            '',
            '1.12',
            true
        );
        const config = await builder.build();

        const singboxKeys = new Set([
            'log', 'dns', 'ntp', 'inbounds', 'outbounds', 'route', 'experimental',
            'services', 'endpoints', 'http_clients'
        ]);
        expect(Object.keys(config).filter(key => !singboxKeys.has(key))).toEqual([]);
        // the nodes themselves must survive
        expect(config.outbounds.filter(outbound => outbound.server).map(outbound => outbound.tag)).toEqual(['HK-01']);
    });
});
