import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { addProxyWithDedup, proxyFingerprint } from '../src/builders/helpers/proxyHelpers.js';
import { foldCountryGroups } from '../src/utils.js';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

describe('physical fingerprint dedup', () => {
    it('merges the same endpoint described with different names and transport fields', () => {
        const proxies = [];
        const signature = (item) => proxyFingerprint(item) || JSON.stringify(item);
        addProxyWithDedup(proxies, {
            name: 'Node-A', type: 'vless', server: 'example.com', port: 443,
            uuid: '11111111-1111-1111-1111-111111111111',
            tls: { fingerprint: 'chrome' }, network: 'ws', path: '/a'
        }, { getSignature: signature });
        addProxyWithDedup(proxies, {
            name: 'Node-B', type: 'vless', server: 'Example.COM', port: 443,
            uuid: '11111111-1111-1111-1111-111111111111',
            tls: { fingerprint: 'firefox' }, network: 'ws', path: '/b'
        }, { getSignature: signature });
        expect(proxies).toHaveLength(1);
        expect(proxies[0].name).toBe('Node-A');
    });

    it('keeps nodes apart when uuid or port differs', () => {
        const proxies = [];
        const signature = (item) => proxyFingerprint(item) || JSON.stringify(item);
        const base = { type: 'vless', server: 'example.com', port: 443, uuid: '11111111-1111-1111-1111-111111111111' };
        addProxyWithDedup(proxies, { ...base, name: 'A' }, { getSignature: signature });
        addProxyWithDedup(proxies, { ...base, uuid: '22222222-2222-2222-2222-222222222222', name: 'B' }, { getSignature: signature });
        addProxyWithDedup(proxies, { ...base, port: 8443, name: 'C' }, { getSignature: signature });
        expect(proxies).toHaveLength(3);
    });
});

describe('country folding', () => {
    it('folds single-node non-core countries into their continent group', () => {
        const folded = foldCountryGroups({
            Netherlands: { code: 'NL', name: 'Netherlands', emoji: '🇳🇱', aliases: ['Netherlands'], proxies: ['NL-1'] },
            Germany: { code: 'DE', name: 'Germany', emoji: '🇩🇪', aliases: ['Germany'], proxies: ['DE-1'] },
            Japan: { code: 'JP', name: 'Japan', emoji: '🇯🇵', aliases: ['Japan'], proxies: ['JP-1'] },
            'United States': { code: 'US', name: 'United States', emoji: '🇺🇸', aliases: ['United States'], proxies: ['US-1', 'US-2'] }
        });
        expect(folded['欧洲其他'].proxies).toEqual(expect.arrayContaining(['NL-1', 'DE-1']));
        expect(folded.Netherlands).toBeUndefined();
        expect(folded.Germany).toBeUndefined();
        expect(folded.Japan.proxies).toEqual(['JP-1']);
        expect(folded['United States'].proxies).toHaveLength(2);
    });

    it('folds single-node countries in a built Clash config', async () => {
        const input = [
            'ss://YWVzLTEyOC1nY206dGVzdA@nl.example.com:443#Netherlands-1',
            'ss://YWVzLTEyOC1nY206dGVzdA@de.example.com:443#Germany-1',
            'ss://YWVzLTEyOC1nY206dGVzdA@jp.example.com:443#Japan-1'
        ].join('\n');
        const builder = new ClashConfigBuilder(input, 'all', [], null, 'zh-CN', 'test-agent', true);
        const config = yaml.load(await builder.build());
        const groups = config['proxy-groups'] || [];
        expect(groups.find(g => g?.name === '🌍 欧洲其他')?.proxies).toHaveLength(2);
        expect(groups.find(g => g?.name?.includes('Netherlands'))).toBeUndefined();
        expect(groups.find(g => g?.name?.includes('Germany'))).toBeUndefined();
        expect(groups.find(g => g?.name === '🇯🇵 Japan')).toBeDefined();
    });
});

describe('empty system group pruning', () => {
    it('prunes an empty system group and strips its references', () => {
        const builder = new ClashConfigBuilder('ss://YWVzLTEyOC1nY206dGVzdA@example.com:443#Node', 'minimal', [], null, 'zh-CN', 'test-agent');
        builder.config = {
            proxies: [{ name: 'Node-A' }],
            'proxy-groups': [
                { name: 'Empty System', type: 'url-test', proxies: [] },
                { name: 'Selector', type: 'select', proxies: ['Empty System', 'Node-A', 'DIRECT'] }
            ]
        };
        builder.validateProxyGroups();
        expect(builder.config['proxy-groups'].map(g => g.name)).toEqual(['Selector']);
        expect(builder.config['proxy-groups'][0].proxies).toEqual(['Node-A', 'DIRECT']);
    });

    it('still rejects a user-defined empty url-test group', () => {
        const builder = new ClashConfigBuilder('ss://YWVzLTEyOC1nY206dGVzdA@example.com:443#Node', 'minimal', [], null, 'zh-CN', 'test-agent');
        builder.config = {
            proxies: [{ name: 'Node-A' }],
            'proxy-groups': [{ name: 'Empty User', type: 'url-test', proxies: [] }]
        };
        builder.userProxyGroupNames.add('Empty User');
        expect(() => builder.validateProxyGroups()).toThrow('Invalid proxy group "Empty User"');
    });
});
