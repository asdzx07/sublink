import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';
import { CLASH_CONFIG } from '../src/config/clashConfig.js';
import { PROXY_GROUP_ICON_BASE } from '../src/config/proxyGroupIcons.js';

/**
 * Profile settings that must work without a client-side toggle:
 * - the DNS cache uses ARC
 * - every generated group carries an icon
 */

const ss = (name, server) =>
    `  - {name: '${name}', type: ss, server: ${server}, port: 443, cipher: aes-128-gcm, password: test}`;

const inputFor = (names = ['Node-A']) =>
    `proxies:\n${names.map((name, index) => ss(name, `n${index}.example.com`)).join('\n')}\n`;

const build = async ({ rules = 'minimal', customRules = [], groupByCountry = false, proxies = ['Node-A'], baseConfig = null } = {}) => {
    const builder = new ClashConfigBuilder(inputFor(proxies), rules, customRules, baseConfig, 'zh-CN', 'clash-verge/v2.0.0', groupByCountry);
    return yaml.load(await builder.build());
};

const groupByName = (config, name) => (config['proxy-groups'] || []).find(group => group?.name === name);

describe('mihomo dns cache', () => {
    it('uses arc so hot names survive the one-off lookups', async () => {
        const config = await build();

        expect(config.dns['cache-algorithm']).toBe('arc');
    });
});

describe('proxy group icons', () => {
    it('labels the system groups', async () => {
        const config = await build();

        expect(groupByName(config, '🚀 节点选择').icon).toBe(`${PROXY_GROUP_ICON_BASE}Proxy.png`);
        expect(groupByName(config, '⚡ 自动选择').icon).toBe(`${PROXY_GROUP_ICON_BASE}Auto.png`);
        expect(groupByName(config, '🐟 漏网之鱼').icon).toBe(`${PROXY_GROUP_ICON_BASE}Final.png`);
    });

    it('labels rule groups by rule name, not by the translated name', async () => {
        const config = await build({ customRules: [{ name: 'Streaming', site: ['netflix'], ip: [] }] });

        expect(groupByName(config, '🎬 流媒体').icon).toBe(`${PROXY_GROUP_ICON_BASE}Streaming.png`);
    });

    it('labels the rule groups the selected preset generates', async () => {
        // these come from the built-in rules, not from customRules
        const config = await build();

        expect(groupByName(config, '🏠 私有网络').icon).toBe(`${PROXY_GROUP_ICON_BASE}Direct.png`);
        expect(groupByName(config, '🔒 国内服务').icon).toBe(`${PROXY_GROUP_ICON_BASE}CN.png`);
        expect(groupByName(config, '🌐 非中国').icon).toBe(`${PROXY_GROUP_ICON_BASE}Global.png`);
    });

    it('labels country and manual groups', async () => {
        const config = await build({ groupByCountry: true, proxies: ['香港 01', 'Node-A'] });

        expect(groupByName(config, '🇭🇰 Hong Kong').icon).toBe(`${PROXY_GROUP_ICON_BASE}HK.png`);
        expect(groupByName(config, '🖐️ 手动切换').icon).toBe(`${PROXY_GROUP_ICON_BASE}Server.png`);
    });

    it('lets a base config icon win over the generated one', async () => {
        const config = await build({
            baseConfig: {
                ...CLASH_CONFIG,
                'proxy-groups': [{ name: '🚀 节点选择', type: 'select', proxies: ['DIRECT'], icon: 'https://example.com/mine.png' }]
            }
        });

        expect(groupByName(config, '🚀 节点选择').icon).toBe('https://example.com/mine.png');
    });

    it('never mixes icon files across languages', async () => {
        const builder = new ClashConfigBuilder(inputFor(), 'minimal', [], null, 'en-US', 'clash-verge/v2.0.0');
        const config = yaml.load(await builder.build());

        // the mapping is keyed by i18n key, so an English profile gets the same icons
        expect(groupByName(config, '🚀 Node Select').icon).toBe(`${PROXY_GROUP_ICON_BASE}Proxy.png`);
    });
});
