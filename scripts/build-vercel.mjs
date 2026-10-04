import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'dist', 'vercel');
const entryPoint = path.join(rootDir, 'src', 'app', 'createApp.jsx');
const isProduction = process.env.NODE_ENV === 'production';

// 构建时注入 commit 信息，页脚显示用，方便确认部署是否生效
function getCommitSha() {
    // Cloudflare Pages / Vercel 提供的环境变量优先
    const fromEnv = process.env.CF_PAGES_COMMIT_SHA
        || process.env.VERCEL_GIT_COMMIT_SHA
        || process.env.GITHUB_SHA;
    if (fromEnv) return fromEnv.slice(0, 7);
    try {
        return execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
    } catch {
        return 'dev';
    }
}

const COMMIT_SHA = getCommitSha();
const BUILD_TIME = new Date().toISOString().slice(0, 16).replace('T', ' ');

async function ensureOutputDir() {
    await fs.rm(outDir, { recursive: true, force: true });
    await fs.mkdir(outDir, { recursive: true });
}

async function buildForVercel() {
    await ensureOutputDir();
    await build({
        bundle: true,
        entryPoints: [entryPoint],
        format: 'esm',
        logLevel: 'info',
        minify: isProduction,
        outfile: path.join(outDir, 'createApp.js'),
        platform: 'node',
        sourcemap: isProduction ? false : true,
        target: ['node18'],
        define: {
            '__COMMIT_SHA__': JSON.stringify(COMMIT_SHA),
            '__BUILD_TIME__': JSON.stringify(BUILD_TIME)
        }
    });
    console.log(`✓ Built dist/vercel/createApp.js (commit ${COMMIT_SHA}, ${BUILD_TIME})`);
}

buildForVercel().catch((error) => {
    console.error('Failed to build Vercel bundle');
    console.error(error);
    process.exitCode = 1;
});
