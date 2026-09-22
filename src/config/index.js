/**
 * Config Module Index
 * Central export point for all configuration modules
 */

// Rule URLs
export {
	SURGE_SITE_RULE_SET_BASEURL,
	SURGE_IP_RULE_SET_BASEURL
} from './ruleUrls.js';

// Rules
export {
	UNIFIED_RULES,
	PREDEFINED_RULE_SETS,
	DIRECT_DEFAULT_RULES,
	REJECT_ACTION_RULES
} from './rules.js';

// Rule Generators
export {
	getOutbounds,
	generateRules,
	generateRuleSets,
	generateClashRuleSets
} from './ruleGenerators.js';

// Subconverter Config
export { generateSubconverterConfig } from './subconverterConfig.js';

// Platform Configs
export { SING_BOX_CONFIG, SING_BOX_CONFIG_V1_11 } from './singboxConfig.js';
export { CLASH_CONFIG } from './clashConfig.js';
export { SURGE_CONFIG } from './surgeConfig.js';
