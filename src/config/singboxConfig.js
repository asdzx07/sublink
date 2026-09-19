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
				// IPv4 only on purpose. A fake IPv6 address can only live in the
				// ULA range (fc00::/7), which browsers classify as a local-network
				// address and gate behind the "access devices on your local
				// network" permission - that popup fires on every site. Mihomo does
				// not fake AAAA by default either.
				type: "fakeip",
				tag: "dns_fakeip",
				inet4_range: "198.18.0.0/15"
			}
		],
		// Only the two mode rules live here. The rest of the chain - the SVCB/ECH
		// guard, the local name filter, the CN split and the fake address rules - is
		// built by SingboxConfigBuilder.configureDnsRouting, which is also what
		// protects a user-supplied base config. Keeping a second copy here meant two
		// places to update and no way to tell which one had won; the default build and
		// a custom base config now take exactly the same path.
		rules: [
			{
				clash_mode: "direct",
				server: "dns_direct"
			},
			{
				clash_mode: "global",
				server: "dns_proxy"
			}
		],
		// Only query types fakeip cannot answer land here, so keep them on the
		// encrypted proxy-side resolver instead of a public resolver reached
		// outside the tunnel.
		final: "dns_proxy"
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
				// addressed by name so the TLS handshake gets the certificate the
				// endpoint actually serves; 1.1.1.1 does not match it
				tag: "dns_proxy",
				address: "tls://cloudflare-dns.com",
				address_resolver: "dns_resolver",
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
			// no inet6_range: a fake ULA address trips the browser's local-network
			// permission prompt, see the current config
			inet4_range: "198.18.0.0/15"
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
