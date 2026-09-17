import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { SING_BOX_CONFIG } from '../src/config/singboxConfig.js';

/**
 * sing-box 1.15 compatibility (see 废弃功能列表):
 * - 1.15 deprecates the TUN stack option (sing-tun now ships its own stack)
 * - 1.14 deprecates remote rule-set download_detour, the implicit default HTTP
 *   client, independent_cache and store_rdrc/rdrc_timeout
 * The generated config must never carry those fields on the tier used by 1.15+.
 */

const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

const build = async (singboxVersion, baseConfig = null) => {
    const builder = new SingboxConfigBuilder(
        vlessUrl, [], [], baseConfig, 'zh-CN', null, false,
        false, undefined, undefined, singboxVersion
    );
    return builder.build();
};

describe('sing-box 1.15: deprecated tun options', () => {
    it('never emits the deprecated tun stack option', async () => {
        for (const version of ['1.11', '1.12', '1.14']) {
            const result = await build(version);
            const tun = result.inbounds.find(inbound => inbound.type === 'tun');
            expect(tun, `tier ${version}`).toBeDefined();
            expect(tun, `tier ${version}`).not.toHaveProperty('stack');
        }
    });

    it('strips legacy tun fields and merges split address options from a base config', async () => {
        const baseConfig = {
            inbounds: [
                { type: 'tun', tag: 'tun-in', inet4_address: '172.19.0.1/30', inet6_address: 'fdfe:dcba:9876::1/126', stack: 'mixed', gso: true, sniff: true }
            ],
            outbounds: [{ type: 'direct', tag: 'DIRECT' }],
            route: { rule_set: [], rules: [] }
        };

        const result = await build('1.14', baseConfig);
        const tun = result.inbounds.find(inbound => inbound.type === 'tun');

        expect(tun).not.toHaveProperty('stack');
        expect(tun).not.toHaveProperty('gso');
        expect(tun).not.toHaveProperty('sniff');
        expect(tun).not.toHaveProperty('inet4_address');
        expect(tun).not.toHaveProperty('inet6_address');
        expect(tun.address).toEqual(['172.19.0.1/30', 'fdfe:dcba:9876::1/126']);
    });
});

describe('sing-box >=1.14: deprecated dns and rule-set options', () => {
    it('migrates store_rdrc to store_dns and drops independent_cache', async () => {
        const baseConfig = {
            ...SING_BOX_CONFIG,
            dns: { ...SING_BOX_CONFIG.dns, independent_cache: true },
            experimental: { cache_file: { enabled: true, store_fakeip: true, store_rdrc: true, rdrc_timeout: '7d' } }
        };

        const result = await build('1.14', baseConfig);

        expect(result.experimental.cache_file).toEqual({ enabled: true, store_fakeip: true, store_dns: true });
        expect(result.dns).not.toHaveProperty('independent_cache');
    });

    it('keeps store_dns (unknown before 1.14) out of older tiers', async () => {
        const result = await build('1.12');
        expect(result.experimental.cache_file).not.toHaveProperty('store_dns');
    });

    it('pins remote rule-set downloads through http_clients without download_detour', async () => {
        const result = await build('1.14');

        expect(result.http_clients).toEqual([{ tag: 'rule-set-download' }]);
        expect(result.route.default_http_client).toBe('rule-set-download');
        result.route.rule_set.forEach(ruleSet => {
            expect(ruleSet).not.toHaveProperty('download_detour');
        });
    });
});

describe('sing-box >=1.12: no detour to the empty direct outbound', () => {
    it('drops dns server and clash api detours that point at a bare direct outbound', async () => {
        const baseConfig = {
            ...SING_BOX_CONFIG,
            dns: {
                ...SING_BOX_CONFIG.dns,
                servers: SING_BOX_CONFIG.dns.servers.map(server =>
                    server.tag === 'dns_direct' ? { ...server, detour: 'DIRECT' } : server
                )
            },
            experimental: {
                cache_file: { enabled: true, store_fakeip: true },
                clash_api: { external_controller: '0.0.0.0:9090', external_ui_download_detour: 'DIRECT' }
            }
        };

        const result = await build('1.14', baseConfig);

        expect(result.dns.servers.find(server => server.tag === 'dns_direct')).not.toHaveProperty('detour');
        expect(result.experimental.clash_api).not.toHaveProperty('external_ui_download_detour');
    });

    it('keeps the deprecated clash api detour default out of generated configs', async () => {
        const builder = new SingboxConfigBuilder(
            vlessUrl, [], [], null, 'zh-CN', null, false,
            true, undefined, undefined, '1.14'
        );
        const result = await builder.build();

        expect(result.experimental.clash_api.external_controller).toBe('0.0.0.0:9090');
        expect(result.experimental.clash_api).not.toHaveProperty('external_ui_download_detour');
    });
});

describe('sing-box generated dns has no leak path', () => {
    it('resolves through encrypted servers only', async () => {
        const result = await build('1.14');
        const servers = result.dns.servers;

        expect(servers.map(server => server.type).sort()).toEqual(['fakeip', 'https', 'https']);
        // plaintext udp/tcp resolvers would expose every query on the wire
        expect(servers.some(server => server.type === 'udp' || server.type === 'tcp')).toBe(false);
        // hostname-based servers would need a plaintext bootstrap lookup first
        const ipv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
        servers.filter(server => server.type === 'https').forEach(server => {
            expect(server.server).toMatch(ipv4);
        });
    });

    it('routes foreign lookups to fakeip and never leaves global mode on a direct resolver', async () => {
        const result = await build('1.14');
        const rules = result.dns.rules;

        expect(rules[0]).toMatchObject({ clash_mode: 'direct', server: 'dns_direct' });
        expect(rules[1]).toMatchObject({ clash_mode: 'global', server: 'dns_proxy' });
        expect(rules).toContainEqual(
            expect.objectContaining({ rule_set: 'geolocation-!cn', server: 'dns_fakeip' })
        );
        expect(result.route.default_domain_resolver).toBe('dns_direct');
    });

    it('never falls back to a resolver reached outside the tunnel', async () => {
        const result = await build('1.14');

        // the leak test domain is unmatched, so the fallback decides the result
        expect(result.dns.final).toBe('dns_proxy');
        const finalServer = result.dns.servers.find(server => server.tag === result.dns.final);
        expect(finalServer?.detour).toBeDefined();
        // the old "REFUSED everything but A/AAAA/CNAME" rule broke HTTPS/SVCB (ECH)
        expect(result.dns.rules.some(rule => rule.action === 'predefined')).toBe(false);
    });

    it('keeps cn domains on the local resolver, after the foreign rules', async () => {
        const result = await build('1.14');
        const cnRule = result.dns.rules.find(rule => Array.isArray(rule.rule_set) && rule.rule_set.includes('cn'));

        expect(cnRule).toMatchObject({ server: 'dns_direct' });
        expect(result.dns.rules.indexOf(cnRule)).toBe(result.dns.rules.length - 1);
    });

    it('omits the cn rule when the cn rule sets are not generated', async () => {
        const builder = new SingboxConfigBuilder(
            vlessUrl, ['Non-China'], [], null, 'zh-CN', null, false,
            false, undefined, undefined, '1.14'
        );
        const result = await builder.build();
        const tags = result.route.rule_set.map(ruleSet => ruleSet.tag);

        expect(tags).not.toContain('cn');
        expect(result.dns.rules.some(rule => Array.isArray(rule.rule_set) && rule.rule_set.includes('cn'))).toBe(false);
        expect(result.dns.final).toBe('dns_proxy');
    });

    it('covers ipv6 in the tun so it cannot bypass the tunnel', async () => {
        for (const version of ['1.11', '1.12', '1.14']) {
            const result = await build(version);
            const tun = result.inbounds.find(inbound => inbound.type === 'tun');
            const addresses = Array.isArray(tun.address) ? tun.address : [tun.address];

            expect(addresses.some(address => address.includes(':')), `tier ${version}`).toBe(true);
            expect(tun.strict_route, `tier ${version}`).toBe(true);
        }
    });
});
