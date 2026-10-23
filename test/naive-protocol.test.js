import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { ProxyParser } from '../src/parsers/ProxyParser.js';
import { parseNaive } from '../src/parsers/protocols/naiveParser.js';

const HTTPS_URI = 'naive+https://user1:pass1@naive.example.com:1443#Naive%20HTTPS';
const QUIC_URI = 'naive+quic://user2:pass2@quic.example.com:443?sni=sni.example.com&insecure=1#Naive%20QUIC';

describe('Naive protocol support', () => {
    it('parses naive+https links as HTTP/2 over TLS', () => {
        expect(parseNaive(HTTPS_URI)).toEqual({
            tag: 'Naive HTTPS',
            type: 'naive',
            server: 'naive.example.com',
            server_port: 1443,
            username: 'user1',
            password: 'pass1',
            tls: { enabled: true, insecure: false }
        });
    });

    it('parses naive+quic links with the quic flag and tls options', () => {
        expect(parseNaive(QUIC_URI)).toEqual({
            tag: 'Naive QUIC',
            type: 'naive',
            server: 'quic.example.com',
            server_port: 443,
            username: 'user2',
            password: 'pass2',
            quic: true,
            tls: { enabled: true, insecure: true, server_name: 'sni.example.com' }
        });
    });

    it('treats a bare naive:// link as https and defaults the port to 443', () => {
        const parsed = parseNaive('naive://u:p@host.example.com');
        expect(parsed.type).toBe('naive');
        expect(parsed.server_port).toBe(443);
        expect(parsed.quic).toBeUndefined();
    });

    it('routes all naive schemes through ProxyParser', async () => {
        for (const uri of [HTTPS_URI, QUIC_URI, 'naive://u:p@host.example.com:8443']) {
            expect((await ProxyParser.parse(uri))?.type).toBe('naive');
        }
    });

    it('emits a sing-box naive outbound from a share link', async () => {
        const builder = new SingboxConfigBuilder(QUIC_URI, [], [], null, 'zh-CN', null, false, false, undefined, undefined, '1.14');
        const result = await builder.build();
        const outbound = result.outbounds.find(o => o.type === 'naive');
        expect(outbound).toMatchObject({
            tag: 'Naive QUIC',
            server: 'quic.example.com',
            server_port: 443,
            username: 'user2',
            password: 'pass2',
            quic: true,
            tls: { enabled: true, insecure: true, server_name: 'sni.example.com' }
        });
    });

    it('maps naive to a mihomo http proxy (mihomo has no naive type)', async () => {
        const builder = new ClashConfigBuilder(QUIC_URI, 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0');
        const config = yaml.load(await builder.build());
        const proxy = (config.proxies || []).find(p => p.name === 'Naive QUIC');
        expect(proxy).toMatchObject({
            type: 'http',
            server: 'quic.example.com',
            port: 443,
            username: 'user2',
            password: 'pass2',
            tls: true,
            sni: 'sni.example.com',
            'skip-cert-verify': true,
            'client-fingerprint': 'chrome'
        });
        expect((config.proxies || []).find(p => p.type === 'naive')).toBeUndefined();
    });

    it('converts a mihomo naive proxy to sing-box (protocol name becomes the quic flag)', async () => {
        const clashYaml = [
            'proxies:',
            '  - name: Naive YAML',
            '    type: naive',
            '    server: yaml.example.com',
            '    port: 8443',
            '    username: yu',
            '    password: yp',
            '    protocol: quic',
            '    tls: true',
            '    sni: sni.example.com',
            '    skip-cert-verify: true',
            '    udp: true'
        ].join('\n');
        const builder = new SingboxConfigBuilder(clashYaml, [], [], null, 'zh-CN', null, false, false, undefined, undefined, '1.14');
        const result = await builder.build();
        const outbound = result.outbounds.find(o => o.type === 'naive');
        expect(outbound).toMatchObject({
            tag: 'Naive YAML',
            server: 'yaml.example.com',
            server_port: 8443,
            username: 'yu',
            quic: true,
            tls: { enabled: true, server_name: 'sni.example.com', insecure: true }
        });
        // Clash-only field must not leak into the sing-box outbound
        expect(outbound).not.toHaveProperty('udp');
    });

    it('maps a sing-box naive outbound to a mihomo http proxy as well', async () => {
        const singboxJson = JSON.stringify({
            outbounds: [
                { type: 'naive', tag: 'Naive JSON', server: 'json.example.com', server_port: 443, username: 'ju', password: 'jp', tls: { enabled: true, server_name: 'jsni.example.com', insecure: false } },
                { type: 'direct', tag: 'DIRECT' }
            ]
        });
        const builder = new ClashConfigBuilder(singboxJson, 'minimal', [], null, 'zh-CN', 'clash-verge/v2.0.0');
        const config = yaml.load(await builder.build());
        const proxy = (config.proxies || []).find(p => p.name === 'Naive JSON');
        expect(proxy).toMatchObject({
            type: 'http',
            server: 'json.example.com',
            port: 443,
            username: 'ju',
            password: 'jp',
            tls: true,
            sni: 'jsni.example.com',
            'skip-cert-verify': false,
            'client-fingerprint': 'chrome'
        });
    });
});
