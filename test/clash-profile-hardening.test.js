import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

/**
 * Profile settings that must work without a client-side toggle: the DNS cache
 * uses ARC.
 */

const input = `proxies:
  - {name: 'Node-A', type: ss, server: a.example.com, port: 443, cipher: aes-128-gcm, password: test}
`;

const build = async () => {
    const builder = new ClashConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0');
    return yaml.load(await builder.build());
};

describe('mihomo dns cache', () => {
    it('uses arc so hot names survive the one-off lookups', async () => {
        const config = await build();

        expect(config.dns['cache-algorithm']).toBe('arc');
    });
});
