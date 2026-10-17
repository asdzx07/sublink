import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

const runtime = {
    kv: new MemoryKVAdapter(),
    assetFetcher: null,
    logger: { info() {}, warn() {}, error() {} },
    config: { configTtlSeconds: 3600, shortLinkTtlSeconds: null }
};

const app = createApp(runtime);

function makeNodes(n) {
    return Array.from({ length: n }, (_, i) =>
        `vless://123e4567-e89b-12d3-a456-426614174000@host${i}.example.com:443?security=tls&sni=host${i}.example.com#Node${i}`
    ).join('\n');
}

describe('store-input + inputId', () => {
    it('stores oversized input and converts via inputId', async () => {
        const longInput = makeNodes(150);
        expect(longInput.length).toBeGreaterThan(2000);

        const storeRes = await app.request('http://example.com/store-input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: longInput })
        });
        expect(storeRes.status).toBe(200);
        const inputId = (await storeRes.text()).trim();
        expect(inputId.startsWith('input_')).toBe(true);

        const convRes = await app.request(
            'http://example.com/singbox?inputId=' + encodeURIComponent(inputId) +
            '&selectedRules=' + encodeURIComponent(JSON.stringify(['Ad Block'])),
            { headers: { 'User-Agent': 'SFA/1.15.0' } }
        );
        expect(convRes.status).toBe(200);
        const cfg = await convRes.json();
        const vlessNodes = (cfg.outbounds || []).filter(o => o.type === 'vless');
        expect(vlessNodes.length).toBe(150);
    });

    it('rejects empty input', async () => {
        const res = await app.request('http://example.com/store-input', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: '   ' })
        });
        expect(res.status).toBe(400);
    });

    it('falls back to inline config param', async () => {
        const res = await app.request(
            'http://example.com/singbox?config=' + encodeURIComponent('vless://123e4567-e89b-12d3-a456-426614174000@h.com:443?security=tls&sni=h.com#N') +
            '&selectedRules=' + encodeURIComponent(JSON.stringify(['Ad Block'])),
            { headers: { 'User-Agent': 'SFA/1.15.0' } }
        );
        expect(res.status).toBe(200);
        const cfg = await res.json();
        expect((cfg.outbounds || []).filter(o => o.type === 'vless').length).toBe(1);
    });
});
