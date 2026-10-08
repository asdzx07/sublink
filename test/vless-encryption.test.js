import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { parseVless } from '../src/parsers/protocols/vlessParser.js';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

/**
 * VLESS Encryption pass-through: the seed in the input link's `encryption`
 * param must survive parsing and be emitted in Mihomo output. sing-box
 * rejects unknown fields and Surge has no support, so only the Clash
 * builder emits it.
 */
const seed = 'test-seed-abc123';
const encLink = `vless://12345678-1234-1234-1234-123456789abc@example.com:443?encryption=${seed}&security=tls&sni=example.com#EncNode`;
const noneLink = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?encryption=none&security=tls&sni=example.com#PlainNode';
const bareLink = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#BareNode';

describe('vless parser keeps encryption seed', () => {
    it('captures a non-none encryption param', () => {
        expect(parseVless(encLink).encryption).toBe(seed);
    });

    it('drops encryption=none', () => {
        expect(parseVless(noneLink).encryption).toBeUndefined();
    });

    it('leaves encryption undefined when absent', () => {
        expect(parseVless(bareLink).encryption).toBeUndefined();
    });
});

describe('clash builder emits encryption for vless', () => {
    const buildProxies = async (link) => {
        const builder = new ClashConfigBuilder(link, 'minimal', [], null, 'zh-CN', 'test-agent');
        const built = yaml.load(await builder.build());
        return built['proxies'] || [];
    };

    it('includes the encryption field for VLESS Encryption nodes', async () => {
        const proxies = await buildProxies(encLink);
        const node = proxies.find(p => p.name === 'EncNode');
        expect(node).toBeDefined();
        expect(node.encryption).toBe(seed);
    });

    it('omits the encryption field for plain vless nodes', async () => {
        for (const link of [noneLink, bareLink]) {
            const proxies = await buildProxies(link);
            const node = proxies[0];
            expect(node).toBeDefined();
            expect('encryption' in node).toBe(false);
        }
    });
});
