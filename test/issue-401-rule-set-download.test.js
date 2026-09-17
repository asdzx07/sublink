import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { SING_BOX_CONFIG } from '../src/config/index.js';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

/**
 * Issues #401/#408: remote rule-sets must not rely on sing-box's implicit
 * default HTTP client (deprecated in 1.14, removed in 1.16) and downloads
 * should go DIRECT so fetching never depends on a proxy that is not up yet.
 *
 * A detour pointing at a bare direct outbound is rejected by sing-box >=1.12
 * ("detour to an empty direct outbound makes no sense") because omitting the
 * detour already dials directly, so download_detour is only emitted on the
 * pre-1.12 tier while >=1.14 gets an explicit shared http_clients entry.
 */
describe('sing-box rule-set download detour', () => {
    const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

    const buildWithVersion = async (singboxVersion, baseConfig = null) => {
        const builder = new SingboxConfigBuilder(
            vlessUrl, [], [], baseConfig, 'zh-CN', null, false,
            false, undefined, undefined, singboxVersion
        );
        return builder.build();
    };

    it('never points a remote rule-set at the empty direct outbound on 1.12', async () => {
        const result = await buildWithVersion('1.12');
        const ruleSets = result.route.rule_set;
        expect(ruleSets.length).toBeGreaterThan(0);
        ruleSets.forEach(rs => {
            expect(rs).not.toHaveProperty('download_detour');
            expect(rs).not.toHaveProperty('http_client');
        });
        expect(result).not.toHaveProperty('http_clients');
        expect(result.route).not.toHaveProperty('default_http_client');
    });

    it('adds download_detour on the 1.11 tier', async () => {
        const result = await buildWithVersion('1.11');
        const ruleSets = result.route.rule_set;
        expect(ruleSets.length).toBeGreaterThan(0);
        ruleSets.forEach(rs => {
            if (rs.type === 'remote') {
                expect(rs.download_detour).toBe('DIRECT');
                expect(rs).not.toHaveProperty('http_client');
            }
        });
    });

    it('uses a shared http_client without detour on the 1.14 tier', async () => {
        const result = await buildWithVersion('1.14');
        result.route.rule_set.forEach(rs => {
            expect(rs).not.toHaveProperty('download_detour');
            expect(rs).not.toHaveProperty('http_client');
        });
        expect(result.http_clients).toEqual([{ tag: 'rule-set-download' }]);
        expect(result.route.default_http_client).toBe('rule-set-download');
    });

    it('drops an empty-direct detour from a base config http_clients entry', async () => {
        const baseConfig = {
            ...SING_BOX_CONFIG,
            http_clients: [{ tag: 'my-client', detour: 'DIRECT' }]
        };
        const result = await buildWithVersion('1.14', baseConfig);
        expect(result.http_clients).toEqual([{ tag: 'my-client' }]);
        expect(result.route.default_http_client).toBe('my-client');
    });

    it('keeps a meaningful detour from a base config http_clients entry', async () => {
        const baseConfig = {
            ...SING_BOX_CONFIG,
            http_clients: [{ tag: 'my-client', detour: 'Some Outbound' }]
        };
        const result = await buildWithVersion('1.14', baseConfig);
        expect(result.http_clients).toEqual([{ tag: 'my-client', detour: 'Some Outbound' }]);
    });
});

describe('sing-box version tier resolution', () => {
    const vmessUrl = 'vmess://ew0KICAidiI6ICIyIiwNCiAgInBzIjogInRlc3QiLA0KICAiYWRkIjogIjEuMS4xLjEiLA0KICAicG9ydCI6ICI0NDMiLA0KICAiaWQiOiAiYWRkNjY2NjYtODg4OC04ODg4LTg4ODgtODg4ODg4ODg4ODg4IiwNCiAgImFpZCI6ICIwIiwNCiAgInNjeSI6ICJhdXRvIiwNCiAgIm5ldCI6ICJ3cyIsDQogICJ0eXBlIjogIm5vbmUiLA0KICAiaG9zdCI6ICIiLA0KICAicGF0aCI6ICIvIiwNCiAgInRscyI6ICJ0bHMiDQp9';

    const createTestApp = () => createApp({
        kv: new MemoryKVAdapter(),
        assetFetcher: null,
        logger: console,
        config: { configTtlSeconds: 60, shortLinkTtlSeconds: null }
    });

    const fetchConfig = (query = '', headers) => {
        const app = createTestApp();
        return app.request(`http://localhost/singbox?config=${encodeURIComponent(vmessUrl)}${query}`, { headers });
    };

    it('returns the 1.14 shape for sb_ver=1.14', async () => {
        const res = await fetchConfig('&sb_ver=1.14');
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.route.default_http_client).toBe('rule-set-download');
    });

    it('returns the 1.14 shape for a sing-box 1.14 user-agent', async () => {
        const res = await fetchConfig('', {
            'User-Agent': 'SFA/1.14.0 (100; sing-box 1.14.0; language zh_Hans_CN)'
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.route.default_http_client).toBe('rule-set-download');
    });

    it('returns the 1.14 shape for a sing-box 1.15 user-agent', async () => {
        const res = await fetchConfig('', {
            'User-Agent': 'SFM/1.15.0 (100; sing-box 1.15.0; language zh_Hans_CN)'
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.route.default_http_client).toBe('rule-set-download');
        expect(json.http_clients).toEqual([{ tag: 'rule-set-download' }]);
    });

    it('maps sb_ver=latest to the newest tier', async () => {
        const res = await fetchConfig('&sb_ver=latest');
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.route.default_http_client).toBe('rule-set-download');
    });

    it('never emits download_detour on the 1.12 tier', async () => {
        const res = await fetchConfig('&sb_ver=1.12');
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).not.toHaveProperty('http_clients');
        json.route.rule_set.forEach(rs => {
            expect(rs).not.toHaveProperty('download_detour');
        });
    });

    it('falls back to the safe 1.12 tier when no version is detectable', async () => {
        const res = await fetchConfig();
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json).not.toHaveProperty('http_clients');
        json.route.rule_set.forEach(rs => {
            expect(rs).not.toHaveProperty('download_detour');
        });
    });
});
