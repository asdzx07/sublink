import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

/**
 * P0: the ad-block group used to list Node Select first, so ads silently went
 * through the proxy instead of being blocked. REJECT must lead the group
 * (a select group defaults to its first member), with DIRECT kept as an
 * escape hatch for rule-set false positives.
 */
const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

const buildGroups = async (selectedRules) => {
    const builder = new ClashConfigBuilder(vlessUrl, selectedRules, [], null, 'zh-CN', 'test-agent');
    const built = yaml.load(await builder.build());
    return built['proxy-groups'] || [];
};

describe('clash ad-block group defaults to REJECT', () => {
    it('puts REJECT first and DIRECT second in the ad-block group', async () => {
        const groups = await buildGroups(['Ad Block']);
        const adGroup = groups.find(g => g && g.name === '🛑 广告拦截');
        expect(adGroup).toBeDefined();
        expect(adGroup.type).toBe('select');
        expect(adGroup.proxies.slice(0, 2)).toEqual(['REJECT', 'DIRECT']);
    });

    it('routes category-ads-all through the ad-block group', async () => {
        const builder = new ClashConfigBuilder(vlessUrl, ['Ad Block'], [], null, 'zh-CN', 'test-agent');
        const text = await builder.build();
        expect(text).toContain('RULE-SET,category-ads-all,🛑 广告拦截');
    });

    it('leaves other scenario groups defaulting to node select', async () => {
        const groups = await buildGroups(['Ad Block', 'Google', 'Youtube']);
        for (const group of groups) {
            if (group.name === '🛑 广告拦截') continue;
            expect(group.proxies[0], group.name).not.toBe('REJECT');
        }
    });
});
