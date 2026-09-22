import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

/**
 * mihomo output requirements: the tun inbound must use mihomo's own IP stack
 * (mips) and the dns block must not leave a leak path — every resolver either
 * sits behind the proxy (respect-rules) or is an IP-addressed encrypted DoH.
 */

const input = `
proxies:
  - name: Node-A
    type: ss
    server: a.example.com
    port: 443
    cipher: aes-128-gcm
    password: test
`;

const buildConfig = async () => {
    const builder = new ClashConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0');
    return yaml.load(await builder.build());
};

describe('mihomo tun stack', () => {
    it('enables tun with the mips stack', async () => {
        const config = await buildConfig();

        expect(config.tun).toMatchObject({ enable: true, stack: 'mips', 'auto-route': true });
        // :53 has to reach mihomo's own DNS module, otherwise fake-ip never applies
        // to system lookups; Verge moves the field into its settings and only logs a
        // notice about it, which is harmless
        expect(config.tun['dns-hijack']).toEqual(['any:53']);
    });

    it('carries strict-route in the profile so no client switch is needed', async () => {
        const config = await buildConfig();

        // otherwise the OS is free to answer from the physical adapter's resolver
        expect(config.tun['strict-route']).toBe(true);
    });

    it('never hands out a fake ipv6 address', async () => {
        const config = await buildConfig();

        // mihomo can only fake IPv6 inside a ULA range (fc00::/7), which browsers
        // treat as local-network access - that is the popup the sing-box profile
        // had to switch off, so the Clash profile must not enable a v6 pool
        expect(config.dns['enhanced-mode']).toBe('fake-ip');
        expect(config.dns).not.toHaveProperty('fake-ip-range6');
        expect(config.tun['auto-route']).toBe(true);
        expect(config.tun['strict-route']).toBe(true);
    });
});

describe('mihomo dns leak prevention', () => {
    it('addresses every resolver by IP so no plaintext bootstrap is needed', async () => {
        const config = await buildConfig();
        const servers = [
            ...config.dns.nameserver,
            ...config.dns['proxy-server-nameserver'],
            ...Object.values(config.dns['nameserver-policy']).flat()
        ];

        servers.forEach(server => {
            const host = new URL(server).hostname;
            expect(host, `${server} should be an IP literal`).toMatch(/^\d{1,3}(?:\.\d{1,3}){3}$/);
        });
    });

    it('resolves non-china domains through encrypted resolvers that respect the rules', async () => {
        const config = await buildConfig();
        const foreign = config.dns['nameserver-policy']['geosite:geolocation-!cn'];

        expect(config.dns['respect-rules']).toBe(true);
        expect(config.dns['enhanced-mode']).toBe('fake-ip');
        foreign.forEach(server => {
            expect(server).toMatch(/^https:\/\/(?:1\.1\.1\.1|8\.8\.8\.8)\/dns-query/);
        });
    });

    it('keeps local and private hostnames out of the fake-ip pool', async () => {
        const config = await buildConfig();

        expect(config.dns['fake-ip-filter']).toContain('*.lan');
        expect(config.dns['fake-ip-filter']).toContain('*.local');
        // the sing-box profile filters the RFC 8375 home network too
        expect(config.dns['fake-ip-filter']).toContain('+.home.arpa');
    });
});

describe('mihomo profile hardening', () => {
    it('sniffs only to classify, never to rewrite the destination', async () => {
        const config = await buildConfig();

        // a pure-IP connection carries no domain, so without sniffing it can only
        // be matched by the ip rules
        expect(config.sniffer).toMatchObject({
            enable: true,
            'override-destination': false,
            'parse-pure-ip': true
        });
        // rewriting the destination from a sniffed name is what lets domain
        // fronting dodge the route rules
        expect(config.sniffer.sniff.TLS.ports).toContain(443);
        expect(config.sniffer.sniff.QUIC.ports).toContain(443);
        expect(config.sniffer['skip-domain']).toContain('+.push.apple.com');
    });

    it('drops svcb/ech answers at every resolver', async () => {
        const config = await buildConfig();
        const servers = [
            ...config.dns.nameserver,
            ...config.dns['proxy-server-nameserver'],
            ...Object.values(config.dns['nameserver-policy']).flat()
        ];

        // a real ipv4hint/ECH config would let the browser bypass the fake mapping
        // and fail the handshake on the proxy path; dropping it also saves a query
        servers.forEach(server => {
            expect(server, server).toContain('disable-qtype-65=true');
            expect(server, server).toContain('disable-qtype-64=true');
        });
    });

    it('keeps the selected node and the fake-ip mappings across restarts', async () => {
        const config = await buildConfig();

        expect(config.profile).toEqual({ 'store-selected': true, 'store-fake-ip': true });
    });

    it('compares node delays uniformly and races resolved addresses', async () => {
        const config = await buildConfig();

        // must travel with the profile: clients without the switch would otherwise
        // report a latency that includes the handshake
        expect(config['unified-delay']).toBe(true);
        expect(config['tcp-concurrent']).toBe(true);
        // the platform already keeps its own clock (w32time / systemd-timesyncd)
        expect(config).not.toHaveProperty('ntp');
    });
});
