import { describe, it, expect, vi, afterEach } from 'vitest';
import yaml from 'js-yaml';

vi.mock('../src/parsers/subscription/httpSubscriptionFetcher.js', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        fetchSubscriptionWithFormat: vi.fn()
    };
});

import { fetchSubscriptionWithFormat } from '../src/parsers/subscription/httpSubscriptionFetcher.js';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

/**
 * Issue #403 originally covered country groups built over provider members.
 * A Clash subscription is now inlined instead (see: imported profile had no
 * nodes), so country groups are built from real inline nodes again - the
 * provider path only remains for payloads that carry nothing to inline.
 */
const mockClashYaml = `
proxies:
  - name: 香港节点01
    type: ss
    server: hk.example.com
    port: 443
    cipher: aes-128-gcm
    password: test123
  - name: 日本节点01
    type: ss
    server: jp.example.com
    port: 443
    cipher: aes-128-gcm
    password: test456
`;

const SUB_URL = 'https://example.com/clash-sub?token=xxx';

const mockClashSubscription = () => {
    fetchSubscriptionWithFormat.mockResolvedValue({
        content: mockClashYaml,
        format: 'clash',
        url: SUB_URL
    });
};

const findGroup = (config, name) => (config['proxy-groups'] || []).find(g => g && g.name === name);

describe('issue #403: country groups from a Clash subscription', () => {
    afterEach(() => vi.clearAllMocks());

    it('creates country groups from the inlined nodes', async () => {
        mockClashSubscription();
        const builder = new ClashConfigBuilder(SUB_URL, [], [], null, 'zh-CN', 'test-agent', true);
        const config = yaml.load(await builder.build());

        // no provider: the profile carries the nodes itself
        expect(config['proxy-providers']).toBeUndefined();
        expect(config.proxies.map(proxy => proxy.name)).toEqual(['香港节点01', '日本节点01']);

        const hkGroup = findGroup(config, '🇭🇰 Hong Kong');
        expect(hkGroup).toBeDefined();
        expect(hkGroup.type).toBe('url-test');
        expect(hkGroup.proxies).toEqual(['香港节点01']);
        expect(hkGroup.use).toBeUndefined();
        expect(hkGroup.filter).toBeUndefined();

        const jpGroup = findGroup(config, '🇯🇵 Japan');
        expect(jpGroup).toBeDefined();
        expect(jpGroup.proxies).toEqual(['日本节点01']);
    });

    it('keeps a word-boundary match when detecting the country', async () => {
        // "plus" must not be read as the US alias
        const usYaml = mockClashYaml
            .replace('日本节点01', 'US-Node')
            .replace('香港节点01', 'plus-node');
        fetchSubscriptionWithFormat.mockResolvedValue({ content: usYaml, format: 'clash', url: SUB_URL });

        const builder = new ClashConfigBuilder(SUB_URL, [], [], null, 'zh-CN', 'test-agent', true);
        const config = yaml.load(await builder.build());

        const usGroup = findGroup(config, '🇺🇸 United States');
        expect(usGroup).toBeDefined();
        expect(usGroup.proxies).toEqual(['US-Node']);
        expect(usGroup.proxies).not.toContain('plus-node');
    });

    it('references the country groups from the Node Select group', async () => {
        mockClashSubscription();
        const builder = new ClashConfigBuilder(SUB_URL, [], [], null, 'zh-CN', 'test-agent', true);
        const config = yaml.load(await builder.build());

        const nodeSelect = findGroup(config, '🚀 节点选择');
        expect(nodeSelect).toBeDefined();
        expect(nodeSelect.proxies).toContain('🇭🇰 Hong Kong');
        expect(nodeSelect.proxies).toContain('🇯🇵 Japan');
    });

    it('does not add filter when there are no providers', async () => {
        const input = 'ss://YWVzLTEyOC1nY206dGVzdA@example.com:443#香港节点';
        const builder = new ClashConfigBuilder(input, [], [], null, 'zh-CN', 'test-agent', true);
        const config = yaml.load(await builder.build());

        const hkGroup = findGroup(config, '🇭🇰 Hong Kong');
        expect(hkGroup).toBeDefined();
        expect(hkGroup.use).toBeUndefined();
        expect(hkGroup.filter).toBeUndefined();
    });
});
