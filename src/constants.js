// Application constants
export const APP_NAME = 'Sublink Worker';
export const APP_VERSION = '2.4.2';
// 构建时由 esbuild define 注入；本地直接跑源码时回退为 'dev'
export const COMMIT_SHA = typeof __COMMIT_SHA__ !== 'undefined' ? __COMMIT_SHA__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';
export const GITHUB_REPO = 'https://github.com/asdzx07/sublink';
export const GITHUB_API_RELEASES = 'https://api.github.com/repos/asdzx07/sublink/releases/latest';
// Original upstream project this fork is based on
export const UPSTREAM_REPO = 'https://github.com/7Sageer/sublink-worker';
export const DOCS_URL = 'https://sublink.works';

// SEO and metadata
export const APP_KEYWORDS = 'clash, singbox, surge, subscription, converter, sublink';

// Subtitles for different languages
export const APP_SUBTITLE = {
    'zh-CN': '高效聚合与管理您的代理节点',
    'en-US': 'Efficiently Aggregate and Manage Your Proxy Nodes',
    'fa': 'تجمیع و مدیریت کارآمد نودهای پروکسی شما',
    'ru': 'Эффективная агрегация и управление вашими прокси-узлами'
};
