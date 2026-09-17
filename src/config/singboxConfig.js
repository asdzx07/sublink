/**
 * Sing-box Configuration
 * Base configuration template for Sing-box client
 */

export const SING_BOX_CONFIG = {
	// Every server is addressed by IP on purpose: hostname-based servers would
	// need a plaintext bootstrap resolver, which both leaks queries and adds a
	// round trip before the first real lookup.
	dns: {
		// The TLS server name is spelled out for the same reason as the IP: these
		// endpoints only serve their certificate for that name, so dialing them by
		// IP without it fails the handshake and silently kills every lookup that
		// depends on the resolver.
		servers: [
			{
				type: "https",
				tag: "dns_proxy",
				server: "1.1.1.1",
				path: "/dns-query",
				tls: {
					enabled: true,
					server_name: "cloudflare-dns.com"
				},
				detour: "🚀 节点选择"
			},
			{
				type: "https",
				tag: "dns_direct",
				server: "223.5.5.5",
				path: "/dns-query",
				tls: {
					enabled: true,
					server_name: "dns.alidns.com"
				}
			},
			{
				type: "fakeip",
				tag: "dns_fakeip",
				inet4_range: "198.18.0.0/15",
				inet6_range: "fc00::/18"
			}
		],
		rules: [
			{
				clash_mode: "direct",
				server: "dns_direct"
			},
			{
				clash_mode: "global",
				server: "dns_proxy"
			},
			{
				// SVCB/HTTPS answers carry real ipv4hint/ipv6hint plus an ECH config.
				// Handing those to the browser while fakeip is in use makes it skip
				// the fake mapping, dial the real hints and attempt ECH through the
				// proxy - which is how Cloudflare-hosted sites end up unreachable.
				// Answer "success, no records" (NODATA) so clients fall back to the
				// A/AAAA answers instead. Not REFUSED: that makes resolvers retry.
				query_type: [
					"HTTPS",
					"SVCB"
				],
				action: "predefined",
				rcode: "NOERROR"
			},
			{
				rule_set: "geolocation-!cn",
				query_type: [
					"A",
					"AAAA"
				],
				server: "dns_fakeip"
			},
			{
				rule_set: "geolocation-!cn",
				query_type: "CNAME",
				server: "dns_proxy"
			},
			{
				query_type: [
					"A",
					"AAAA",
					"CNAME"
				],
				invert: true,
				action: "predefined",
				rcode: "REFUSED"
			}
		],
		final: "dns_direct"
	},
	ntp: {
		enabled: true,
		server: 'time.apple.com',
		server_port: 123,
		interval: '30m'
	},
	inbounds: [
		{ type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
		{
			type: 'tun',
			tag: 'tun-in',
			// Both families are required: with an IPv4-only address auto_route
			// installs no IPv6 default route, so IPv6 traffic (including queries
			// to the router/ISP resolver) silently bypasses the tunnel whenever
			// the client has no strict-route switch.
			address: ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'],
			auto_route: true,
			strict_route: true
		}
	],
	outbounds: [
		{ type: "direct", tag: 'DIRECT' }
	],
	route: {
		default_domain_resolver: "dns_direct",
		"rule_set": [
			{
				"tag": "geosite-geolocation-!cn",
				"type": "local",
				"format": "binary",
				"path": "geosite-geolocation-!cn.srs"
			}
		],
		rules: []
	},
	experimental: {
		cache_file: {
			enabled: true,
			store_fakeip: true
		}
	}
};

export const SING_BOX_CONFIG_V1_11 = {
	dns: {
		servers: [
			{
				tag: "dns_proxy",
				address: "tls://1.1.1.1",
				detour: "🚀 节点选择"
			},
			{
				tag: "dns_direct",
				address: "https://dns.alidns.com/dns-query",
				detour: "DIRECT",
				address_resolver: "dns_resolver"
			},
			{
				tag: "dns_resolver",
				address: "223.5.5.5",
				detour: "DIRECT"
			},
			{
				tag: "dns_fakeip",
				address: "fakeip"
			}
		],
		rules: [
			{
				// catch-all fakeip too, so unmatched names never need a real lookup
				query_type: [
					"A",
					"AAAA"
				],
				server: "dns_fakeip"
			},
			{
				query_type: [
					"A",
					"AAAA",
					"CNAME"
				],
				invert: true,
				server: "dns_proxy",
				disable_cache: true
			}
		],
		// Same reasoning as the current config: unmatched lookups must not be
		// answered by a resolver reached outside the tunnel.
		final: "dns_proxy",
		strategy: "prefer_ipv4",
		independent_cache: true,
		fakeip: {
			enabled: true,
			inet4_range: "198.18.0.0/15",
			inet6_range: "fc00::/18"
		}
	},
	ntp: {
		enabled: true,
		server: 'time.apple.com',
		server_port: 123,
		interval: '30m'
	},
	inbounds: [
		{ type: 'mixed', tag: 'mixed-in', listen: '0.0.0.0', listen_port: 2080 },
		{
			type: 'tun',
			tag: 'tun-in',
			// IPv4-only addressing let IPv6 escape the tunnel; see the current config.
			address: ['172.19.0.1/30', 'fdfe:dcba:9876::1/126'],
			auto_route: true,
			strict_route: true
		}
	],
	outbounds: [
		{ type: "direct", tag: 'DIRECT' }
	],
	route: {
		"rule_set": [],
		rules: []
	},
	experimental: {
		cache_file: {
			enabled: true,
			store_fakeip: true
		}
	}
};
