/**
 * Clash Configuration
 * Base configuration template for Clash client
 */

export const CLASH_CONFIG = {
	'port': 7890,
	'socks-port': 7891,
	'allow-lan': false,
	'mode': 'rule',
	'log-level': 'info',
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
	// All resolvers are addressed by IP so bootstrap never needs plaintext DNS,
	// and foreign traffic only ever resolves through encrypted DoH that the
	// route rules push into the proxy.
	'dns': {
		'enable': true,
		'ipv6': true,
		'respect-rules': true,
		'enhanced-mode': 'fake-ip',
		'fake-ip-filter': [
			'*.lan',
			'*.local',
			'*.localdomain',
			'+.msftconnecttest.com',
			'+.msftncsi.com'
		],
		'default-nameserver': [
			'223.5.5.5',
			'119.29.29.29'
		],
		'nameserver': [
			'https://223.5.5.5/dns-query',
			'https://120.53.53.53/dns-query'
		],
		'proxy-server-nameserver': [
			'https://223.5.5.5/dns-query',
			'https://120.53.53.53/dns-query'
		],
		'nameserver-policy': {
			'geosite:cn,private': [
				'https://223.5.5.5/dns-query',
				'https://120.53.53.53/dns-query'
			],
			'geosite:geolocation-!cn': [
				'https://1.1.1.1/dns-query',
				'https://8.8.8.8/dns-query'
			]
		}
	},
	'proxies': [],
	'proxy-groups': []
};
