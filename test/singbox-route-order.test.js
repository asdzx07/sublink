import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';

/**
 * clash_mode rules were removed (dead without experimental.clash_api).
 * This test now pins that hijack-dns is present and no clash_mode rules exist.
 */
describe('sing-box route.rules: hijack-dns ordering', () => {
    const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

    it('hijack-dns present and no clash_mode rules (removed as dead code)', async () => {
        const builder = new SingboxConfigBuilder(vlessUrl, [], [], null, 'zh-CN', null, false);
        const result = await builder.build();
        const rules = result.route.rules;

        const dnsHijackIdx = rules.findIndex(r => r.action === 'hijack-dns' && r.protocol === 'dns');
        const firstClashModeIdx = rules.findIndex(r => r.clash_mode);

        expect(dnsHijackIdx).toBeGreaterThanOrEqual(0);
        expect(firstClashModeIdx).toBe(-1);
    });

    it('sniff action is present and precedes hijack-dns', async () => {
        const builder = new SingboxConfigBuilder(vlessUrl, [], [], null, 'zh-CN', null, false);
        const result = await builder.build();
        const rules = result.route.rules;

        const sniffIdx = rules.findIndex(r => r.action === 'sniff' && !r.protocol);
        const dnsHijackIdx = rules.findIndex(r => r.action === 'hijack-dns');

        expect(sniffIdx).toBeGreaterThanOrEqual(0);
        expect(sniffIdx).toBeLessThan(dnsHijackIdx);
    });
});
