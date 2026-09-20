import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

/**
 * Profile settings that must work without a client-side toggle: the DNS cache
 * uses ARC.
 */

const ss = (name, server) =>
    `  - {name: '${name}', type: ss, server: ${server}, port: 443, cipher: aes-128-gcm, password: test}`;

const inputFor = (names = ['Node-A']) =>
    `proxies:\n${names.map((name, index) => ss(name, `n${index}.example.com`)).join('\n')}\n`;

const build = async ({ rules = 'minimal', customRules = [], groupByCountry = false, proxies = ['Node-A'], baseConfig = null } = {}) => {
    const builder = new ClashConfigBuilder(inputFor(proxies), rules, customRules, baseConfig, 'zh-CN', 'clash-verge/v2.0.0', groupByCountry);
    return yaml.load(await builder.build());
};

describe('mihomo dns cache', () => {
    it('uses arc so hot names survive the one-off lookups', async () => {
        const config = await build();

        expect(config.dns['cache-algorithm']).toBe('arc');
    });
});
