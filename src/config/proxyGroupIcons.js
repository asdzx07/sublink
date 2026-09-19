/**
 * Proxy group icons for the Clash profile.
 *
 * Clients download these URLs themselves, so a missing file only costs the icon
 * and can never break the profile. Names come from Koolson/Qure's Color set (the
 * usual source for mihomo icons) and are served through jsDelivr, which is
 * reachable from CN and already serves this project's geo data.
 *
 * Group names are translated, so the mapping is keyed by i18n key / rule name
 * instead of the displayed text: the icon then follows the language for free.
 * Country groups are matched through COUNTRY_DATA; codes the upstream set does
 * not ship (e.g. ZA, NL, CH) simply get no icon.
 */

export const PROXY_GROUP_ICON_BASE = 'https://testingcf.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/';

// i18n key -> icon file
export const SYSTEM_GROUP_ICONS = {
	'outboundNames.Node Select': 'Proxy.png',
	'outboundNames.Auto Select': 'Auto.png',
	'outboundNames.Fall Back': 'Final.png',
	'outboundNames.Manual Switch': 'Server.png'
};

// UNIFIED_RULES entry name -> icon file
export const RULE_GROUP_ICONS = {
	'Ad Block': 'Advertising.png',
	'AI Services': 'AI.png',
	'Bilibili': 'bilibili.png',
	'Youtube': 'YouTube.png',
	'Google': 'Google.png',
	'Private': 'Direct.png',
	'Location:CN': 'CN.png',
	'Telegram': 'Telegram.png',
	'Github': 'GitHub.png',
	'Microsoft': 'Microsoft.png',
	'Apple': 'Apple.png',
	'Social Media': 'Facebook.png',
	'Streaming': 'Streaming.png',
	'Gaming': 'Game.png',
	'Education': 'Scholar.png',
	'Financial': 'PayPal.png',
	'Cloud Services': 'Server.png',
	'Non-China': 'Global.png'
};

// COUNTRY_DATA code -> icon file
export const COUNTRY_GROUP_ICONS = {
	HK: 'HK.png',
	TW: 'TW.png',
	JP: 'JP.png',
	KR: 'KR.png',
	SG: 'SG.png',
	US: 'US.png',
	GB: 'UK.png',
	DE: 'DE.png',
	FR: 'FR.png',
	RU: 'RU.png',
	CA: 'CA.png',
	AU: 'AU.png',
	IN: 'IN.png',
	BR: 'BR.png',
	AR: 'AR.png',
	TR: 'TR.png',
	MY: 'MY.png',
	TH: 'TH.png',
	PH: 'PH.png'
};
