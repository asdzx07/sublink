import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { SurgeConfigBuilder } from '../src/builders/SurgeConfigBuilder.js';

/**
 * Rule group trimming (2026-10-07):
 * - Ad-block groups keep only REJECT + DIRECT (node options are meaningless
 *   for ads and invite accidental mis-selection).
 * - Private / Location:CN groups keep only DIRECT + Node Select.
 * sing-box has no ad-block selector at all (rules reject directly), so only
 * the Private/CN trimming applies there.
 */
const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

describe('sing-box trimmed rule groups', () => {
    const buildOutbounds = async (selectedRules) => {
        const builder = new SingboxConfigBuilder(vlessUrl, selectedRules, [], null, 'zh-CN', 'test-agent');
        const config = await builder.build();
        return config.outbounds || [];
    };

    it('has no ad-block selector (ad rules reject directly)', async () => {
        const outbounds = await buildOutbounds(['Ad Block', 'Private', 'Location:CN']);
        expect(outbounds.some(o => o && o.tag === '🛑 广告拦截')).toBe(false);
    });

    it('Private and Location:CN selectors contain only DIRECT and Node Select', async () => {
        const outbounds = await buildOutbounds(['Private', 'Location:CN']);
        for (const tag of ['🏠 私有网络', '🔒 国内服务']) {
            const ob = outbounds.find(o => o && o.tag === tag);
            expect(ob).toBeDefined();
            expect(ob.type).toBe('selector');
            expect(ob.outbounds).toEqual(['DIRECT', '🚀 节点选择']);
        }
    });
});

describe('surge trimmed rule groups', () => {
    const buildText = async (selectedRules) => {
        const builder = new SurgeConfigBuilder(vlessUrl, selectedRules, [], null, 'zh-CN', 'test-agent');
        return builder.build();
    };

    it('ad-block group contains only REJECT and DIRECT', async () => {
        const text = await buildText(['Ad Block']);
        expect(text).toContain('🛑 广告拦截 = select, REJECT, DIRECT');
    });

    it('Private and Location:CN groups contain only DIRECT and Node Select', async () => {
        const text = await buildText(['Private', 'Location:CN']);
        expect(text).toContain('🏠 私有网络 = select, DIRECT, 🚀 节点选择');
        expect(text).toContain('🔒 国内服务 = select, DIRECT, 🚀 节点选择');
    });
});
