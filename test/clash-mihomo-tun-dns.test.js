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
        expect(config.tun['dns-hijack']).toEqual(['any:53']);
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

        expect(config.dns['respect-rules']).toBe(true);
        expect(config.dns['enhanced-mode']).toBe('fake-ip');
        expect(config.dns['nameserver-policy']['geosite:geolocation-!cn']).toEqual([
            'https://1.1.1.1/dns-query',
            'https://8.8.8.8/dns-query'
        ]);
    });

    it('keeps local and private hostnames out of the fake-ip pool', async () => {
        const config = await buildConfig();

        expect(config.dns['fake-ip-filter']).toContain('*.lan');
        expect(config.dns['fake-ip-filter']).toContain('*.local');
    });
});
