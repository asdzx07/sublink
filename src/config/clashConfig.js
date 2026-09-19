/**
 * Clash Configuration
 * Base configuration template for Clash client
 */

// SVCB(64)/HTTPS(65) answers carry an ECH config plus real ipv4hint/ipv6hint. With
// fake-ip in play the browser dials those hints instead of the fake mapping and
// then fails the ECH handshake on the proxy path - exactly how Cloudflare-hosted
// sites became unreachable. Dropping both types at every resolver also removes a
// query per lookup. Appended to the DoH URLs as mihomo's "#param" syntax.
const NO_SVCB_HINTS = '#disable-qtype-65=true&disable-qtype-64=true';

export const CLASH_CONFIG = {
	'port': 7890,
	'socks-port': 7891,
	'allow-lan': false,
	'mode': 'rule',
	'log-level': 'info',
	// Every node is then measured the same way, and the number matches what the
	// client's own test shows. Kept in the profile because some clients expose no
	// such switch: without it the reported latency still includes the handshake and
	// reads higher. Measurement only - routing and resolution are untouched.
	'unified-delay': true,
	// A connection races the resolved addresses instead of trying them one by one.
	// Only addresses of the same domain are raced, so nothing extra is disclosed.
	'tcp-concurrent': true,
	'geodata-mode': true,
	'geo-auto-update': true,
	'geodata-loader': 'standard',
	'geo-update-interval': 24,
	'geox-url': {
		'geoip': "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat",
		'geosite': "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
		'mmdb': "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb",
		'asn': "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb"
	},
	'tun': {
		'enable': true,
		// mihomo's in-house IP stack; faster and lighter than gvisor/system
		'stack': 'mips',
		'auto-route': true,
		'auto-detect-interface': true,
		// Kept in the profile instead of relying on a client toggle: without it
		// the OS may still resolve through the physical adapter's DNS.
		'strict-route': true,
		'dns-hijack': [
			'any:53'
		]
	},
	'rule-providers': {
		// 将由代码自动生成
	},
	// A manually selected node and the fake-ip mappings survive a restart, so the
	// first request afterwards does not have to re-resolve from scratch. Both are
	// plain local caches, no credential is written.
	'profile': {
		'store-selected': true,
		'store-fake-ip': true
	},
	// Pure-IP connections carry no domain, so without sniffing they can only be
	// matched by the ip rules and fall through to the final group. Sniffing itself
	// reads the name off the connection that is already being opened - it sends no
	// query, so it cannot leak anything. `override-destination` stays off on
	// purpose: rewriting the destination from a sniffed name is what lets domain
	// fronting dodge the rules.
	'sniffer': {
		'enable': true,
		'override-destination': false,
		'force-dns-mapping': false,
		'parse-pure-ip': true,
		'sniff': {
			'HTTP': {
				'ports': [
					80,
					'8080-8880'
				]
			},
			'TLS': {
				'ports': [
					443,
					8443
				]
			},
			'QUIC': {
				'ports': [
					443,
					8443
				]
			}
		},
		// push services stop working when their connection is sniffed
		'skip-domain': [
			'Mijia Cloud',
			'+.push.apple.com'
		]
	},
	// All resolvers are addressed by IP so bootstrap never needs plaintext DNS,
	// and foreign traffic only ever resolves through encrypted DoH that the
	// route rules push into the proxy.
	'dns': {
		'enable': true,
		'ipv6': true,
		// ARC keeps the handful of hot names while still evicting one-off lookups,
		// which plain LRU handles badly once the cache fills up. Purely a local
		// cache policy: it changes neither the resolver nor what is queried.
		'cache-algorithm': 'arc',
		'respect-rules': true,
		'enhanced-mode': 'fake-ip',
		'fake-ip-filter': [
			'*.lan',
			'*.local',
			'*.localdomain',
			// RFC 8375 home network; the sing-box profile filters it as well
			'+.home.arpa',
			'+.msftconnecttest.com',
			'+.msftncsi.com'
		],
		'default-nameserver': [
			'223.5.5.5',
			'119.29.29.29'
		],
		'nameserver': [
			`https://223.5.5.5/dns-query${NO_SVCB_HINTS}`,
			`https://120.53.53.53/dns-query${NO_SVCB_HINTS}`
		],
		'proxy-server-nameserver': [
			`https://223.5.5.5/dns-query${NO_SVCB_HINTS}`,
			`https://120.53.53.53/dns-query${NO_SVCB_HINTS}`
		],
		'nameserver-policy': {
			'geosite:cn,private': [
				`https://223.5.5.5/dns-query${NO_SVCB_HINTS}`,
				`https://120.53.53.53/dns-query${NO_SVCB_HINTS}`
			],
			'geosite:geolocation-!cn': [
				`https://1.1.1.1/dns-query${NO_SVCB_HINTS}`,
				`https://8.8.8.8/dns-query${NO_SVCB_HINTS}`
			]
		}
	},
	'proxies': [],
	'proxy-groups': []
};
