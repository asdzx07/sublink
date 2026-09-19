import { describe, it, expect, vi } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { isInfoNodeName, INFO_NODE_PATTERN } from '../src/utils.js';

/**
 * Subscriptions pad their node list with advertisement rows ("剩余流量：12.5GB",
 * "官网", "套餐到期"). They are not proxies: a selector that offers them can never
 * fall back off one, and a latency group that measures one keeps reporting a
 * failure - so they must not survive the conversion.
 */

const ss = (name, server) => `  - name: '${name}'
    type: ss
    server: ${server}
    port: 443
    cipher: aes-128-gcm
    password: test`;

const input = `proxies:\n${[
    ss('香港专线 01', 'a.example.com'),
    ss('剩余流量：12.5GB', 'b.example.com'),
    ss('官网：example.com', 'c.example.com'),
    ss('套餐到期：2026-12-31', 'd.example.com'),
    ss('Traffic: 25GB', 'e.example.com')
].join('\n')}\n`;

const buildClash = async () => yaml.load(
    await new ClashConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0').build()
);

const buildSingbox = async () => new SingboxConfigBuilder(
    input, [], [], null, 'zh-CN', null, false, false, undefined, undefined, '1.14'
).build();

describe('advertisement rows are not nodes', () => {
    it('classifies them by name', () => {
        ['剩余流量：12.5GB', '官网：example.com', '套餐到期时间', '订阅地址', 'Expire Date: 2026-01-01']
            .forEach(name => expect(isInfoNodeName(name), name).toBe(true));

        // real node names must survive
        ['香港专线 01', 'JP-Tokyo-01', '美国 高速', 'SG|家宽']
            .forEach(name => expect(isInfoNodeName(name), name).toBe(false));
    });

    it('drops them from the clash node list', async () => {
        const names = (await buildClash()).proxies.map(proxy => proxy.name);

        expect(names).toContain('香港专线 01');
        expect(names.some(name => isInfoNodeName(name))).toBe(false);
    });

    it('drops them from the sing-box node list', async () => {
        const built = await buildSingbox();
        const tags = built.outbounds.filter(outbound => outbound.server).map(outbound => outbound.tag);

        expect(tags).toContain('香港专线 01');
        expect(tags.some(tag => isInfoNodeName(tag))).toBe(false);
    });

    it('excludes them inside remote providers as well', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            status: 200,
            text: async () => input,
            headers: { get: () => null }
        })));

        try {
            const builder = new ClashConfigBuilder(
                'https://example.com/sub', 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0'
            );
            const config = yaml.load(await builder.build());
            const provider = Object.values(config['proxy-providers'])[0];

            expect(provider['exclude-filter']).toBe(INFO_NODE_PATTERN);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
