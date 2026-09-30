import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';

/**
 * DNS speed follow-up: the 1.14 tier enables the optimistic DNS cache
 * (expired answers served instantly, refreshed in the background) and opts
 * payment/banking names out of it, where a stale answer fails checkouts.
 * Both fields are unknown before 1.14, so older tiers must not carry them.
 */
const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

const build = async (singboxVersion, baseConfig = null) => {
    const builder = new SingboxConfigBuilder(
        vlessUrl, [], [], baseConfig, 'zh-CN', null, false,
        false, undefined, undefined, singboxVersion
    );
    return builder.build();
};

const minimalDnsBase = (dnsExtra = {}) => ({
    dns: {
        servers: [
            { type: 'https', tag: 'dns_proxy', server: '1.1.1.1' },
            { type: 'https', tag: 'dns_direct', server: '223.5.5.5' }
        ],
        rules: [],
        ...dnsExtra
    },
    route: { rule_set: [], rules: [] },
    outbounds: [{ type: 'direct', tag: 'DIRECT' }],
    inbounds: []
});

describe('sing-box DNS: optimistic cache (1.14 tier)', () => {
    it('enables optimistic on 1.14, keeps it off older tiers', async () => {
        const modern = await build('1.14');
        expect(modern.dns.optimistic).toBe(true);

        for (const version of ['1.11', '1.12']) {
            const result = await build(version);
            expect(result.dns, `tier ${version}`).not.toHaveProperty('optimistic');
        }
    });

    it('respects an explicit optimistic=false from a base config', async () => {
        const result = await build('1.14', minimalDnsBase({ optimistic: false }));
        expect(result.dns.optimistic).toBe(false);
    });

    it('opts finance names out of the optimistic cache on 1.14 only', async () => {
        const modern = await build('1.14');
        const rule = modern.dns.rules.find(r =>
            Array.isArray(r?.domain_suffix) && r.domain_suffix.includes('alipay.com'));
        expect(rule).toBeDefined();
        expect(rule.server).toBe('dns_direct');
        expect(rule.disable_optimistic_cache).toBe(true);
        // resolves for real instead of falling through to the fakeip catch-all
        const fakeipIdx = modern.dns.rules.findIndex(r => r.server === 'dns_fakeip');
        expect(modern.dns.rules.indexOf(rule)).toBeLessThan(fakeipIdx);

        for (const version of ['1.11', '1.12']) {
            const result = await build(version);
            const leaked = result.dns.rules.some(r => r?.disable_optimistic_cache === true);
            expect(leaked, `tier ${version}`).toBe(false);
        }
    });

    it('does not duplicate the finance rule when the base config already has it', async () => {
        const base = minimalDnsBase();
        base.dns.rules.push({
            domain_suffix: ['alipay.com'],
            server: 'dns_direct',
            disable_optimistic_cache: true
        });
        const result = await build('1.14', base);
        const count = result.dns.rules.filter(r =>
            Array.isArray(r?.domain_suffix) && r.domain_suffix.includes('alipay.com')).length;
        expect(count).toBe(1);
    });
});

describe('sing-box DNS: prefer_ipv4 strategy', () => {
    it('is declared on the 1.12+ tiers like the 1.11 tier', async () => {
        for (const version of ['1.12', '1.14']) {
            const result = await build(version);
            expect(result.dns.strategy, `tier ${version}`).toBe('prefer_ipv4');
        }
    });
});
