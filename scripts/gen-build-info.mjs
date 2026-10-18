/**
 * 生成 src/buildInfo.js —— 页脚显示的构建编号 / commit / 构建时间。
 *
 * 编号规则：从 build-baseline.txt 记录的提交开始数，每提交一次 +1，
 * 格式补足三位（001、002 …）。这样页脚的 v2.4.2-001 就能对上
 * 「这个仓库改了多少次」，且完全自动，不需要手动维护版本号。
 *
 * 在 Cloudflare Workers Builds / Vercel / 本地 都会跑（见 package.json 的
 * build 与 deploy 脚本），因此部署到 Worker 时也能拿到真实 commit。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outFile = path.join(rootDir, 'src', 'buildInfo.js');
const baselineFile = path.join(rootDir, 'build-baseline.txt');

function readFileOr(file, fallback = '') {
    try {
        return fs.readFileSync(file, 'utf8').trim();
    } catch {
        return fallback;
    }
}

function git(command) {
    return execSync(command, {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
}

function getCommitSha() {
    const fromEnv = process.env.WORKERS_CI_COMMIT_SHA
        || process.env.CF_PAGES_COMMIT_SHA
        || process.env.VERCEL_GIT_COMMIT_SHA
        || process.env.GITHUB_SHA;
    if (fromEnv) return fromEnv.slice(0, 7);
    try {
        return git('git rev-parse --short HEAD');
    } catch {
        return 'dev';
    }
}

// CI 环境可能是浅克隆，浅克隆下提交数不准确，先尝试补全历史
function ensureFullHistory() {
    try {
        if (git('git rev-parse --is-shallow-repository') !== 'true') return;
    } catch {
        return;
    }
    for (const command of ['git fetch --unshallow --quiet', 'git fetch --deepen=200 --quiet']) {
        try {
            execSync(command, { cwd: rootDir, stdio: 'ignore' });
            return;
        } catch {
            // 换下一种方式
        }
    }
}

function commitExists(ref) {
    try {
        // 注意：不要用 ${ref}^{commit}，^ 在 Windows cmd 下是转义符
        git(`git rev-parse --verify --quiet ${ref}`);
        return true;
    } catch {
        return false;
    }
}

function getBuildCount() {
    ensureFullHistory();
    const baseline = readFileOr(baselineFile);

    if (baseline && commitExists(baseline)) {
        try {
            const sinceBaseline = parseInt(git(`git rev-list --count ${baseline}..HEAD`), 10);
            if (Number.isFinite(sinceBaseline) && sinceBaseline >= 0) return sinceBaseline;
        } catch {
            // 落到下面的总数
        }
    }

    try {
        const total = parseInt(git('git rev-list --count HEAD'), 10);
        if (Number.isFinite(total) && total > 0) return total;
    } catch {
        // 没有 git 环境
    }
    return null;
}

const commitSha = getCommitSha();
const count = getBuildCount();

// 拿不到 git 信息时，保留上一次生成的值，避免编号突然归零
const previous = (readFileOr(outFile).match(/BUILD_NUMBER = '(\d+)'/) || [])[1];
const buildNumber = String(count === null ? (previous || 0) : count).padStart(3, '0');
const buildTime = `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

fs.writeFileSync(
    outFile,
    `// 由 scripts/gen-build-info.mjs 自动生成，请勿手动修改\n`
    + `export const BUILD_NUMBER = '${buildNumber}';\n`
    + `export const COMMIT_SHA = '${commitSha}';\n`
    + `export const BUILD_TIME = '${buildTime}';\n`,
    'utf8'
);

console.log(`✓ build info: #${buildNumber} (commit ${commitSha}, ${buildTime})`);
