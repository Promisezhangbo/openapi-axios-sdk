#!/usr/bin/env node
/**
 * openapi-axios-sdk CLI
 *
 * 用法:
 *   openapi-gen                # 读取项目根的 openapi.config.{ts,mjs,js}
 *   openapi-gen --verbose      # 详细日志
 *   openapi-gen --offline      # 不拉取远程 spec,使用上次缓存的快照
 *   openapi-gen -c custom.ts   # 指定配置文件路径(相对项目根)
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGenerate } from '../scripts/generate.mjs';
import { validateRemotes } from '../scripts/remote-utils.mjs';
import { CONFIG_CANDIDATES, DEFAULT_API_DIR, DEFAULT_OUT_DIR } from '../scripts/defaults.mjs';

function parseArgs(argv) {
  const args = { verbose: false, offline: false, configPath: undefined, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verbose' || a === '-v') args.verbose = true;
    else if (a === '--offline') args.offline = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--config' || a === '-c') args.configPath = argv[++i];
    else if (a.startsWith('--config=')) args.configPath = a.slice('--config='.length);
  }
  return args;
}

function printHelp() {
  console.log(`openapi-gen — 从 OpenAPI/Swagger YAML 生成 axios SDK + TS 类型

Usage:
  openapi-gen [options]

Options:
  -c, --config <path>   指定配置文件路径(相对项目根),默认按以下顺序查找:
                          ${CONFIG_CANDIDATES.join(', ')}
      --offline         跳过远程 spec 拉取,使用上次缓存的快照
  -v, --verbose         输出详细日志
  -h, --help            显示帮助

Config(openapi.config.ts):
  import { defineConfig } from 'openapi-axios-sdk/config';
  export default defineConfig({
    apiDir: '${DEFAULT_API_DIR}',
    outDir: '${DEFAULT_OUT_DIR}',
    remotes: [
      { url: 'https://example.com/api/openapi.yaml', name: 'blog' },
    ],
  });
`);
}

async function loadConfigModule(absPath) {
  const ext = path.extname(absPath).toLowerCase();
  if (ext === '.mjs' || ext === '.js' || ext === '.cjs') {
    return await import(pathToFileURL(absPath).href);
  }
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  return await jiti.import(absPath);
}

async function resolveConfig(cwd, explicitPath) {
  if (explicitPath) {
    const abs = path.isAbsolute(explicitPath) ? explicitPath : path.resolve(cwd, explicitPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`指定的配置文件不存在: ${abs}`);
    }
    const mod = await loadConfigModule(abs);
    return { path: abs, raw: mod?.default ?? mod };
  }
  for (const name of CONFIG_CANDIDATES) {
    const abs = path.join(cwd, name);
    if (fs.existsSync(abs)) {
      const mod = await loadConfigModule(abs);
      return { path: abs, raw: mod?.default ?? mod };
    }
  }
  return null;
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const cwd = process.cwd();

  let loaded;
  try {
    loaded = await resolveConfig(cwd, args.configPath);
  } catch (err) {
    console.error(`[openapi-gen] 配置加载失败:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (!loaded) {
    console.error(`[openapi-gen] 找不到配置文件,请在项目根目录创建 ${CONFIG_CANDIDATES.join(' / ')} 之一`);
    console.error(`              或通过 --config <path> 显式指定。`);
    process.exit(1);
  }

  const { path: cfgPath, raw } = loaded;
  if (!raw || typeof raw !== 'object') {
    console.error(`[openapi-gen] ${cfgPath} 的默认导出不是配置对象`);
    process.exit(1);
  }

  let remotes;
  try {
    remotes = validateRemotes(raw.remotes);
  } catch (err) {
    console.error(`[openapi-gen] 配置校验失败:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const verbose = Boolean(args.verbose || raw.verbose);
  const offline = Boolean(args.offline);
  const apiDir = path.resolve(cwd, raw.apiDir ?? DEFAULT_API_DIR);
  const outDir = path.resolve(cwd, raw.outDir ?? DEFAULT_OUT_DIR);

  if (verbose) {
    console.log('[openapi-gen] config:', cfgPath);
    console.log('[openapi-gen] apiDir:', apiDir);
    console.log('[openapi-gen] outDir:', outDir);
    if (remotes.length > 0) {
      console.log('[openapi-gen] remotes:', remotes.map((r) => `${r.name} ← ${r.url}`).join(', '));
    }
    if (offline) console.log('[openapi-gen] mode: offline');
  }

  try {
    await runGenerate({ apiDir, outDir, remotes, offline, verbose });
    if (raw.gitignore) {
      const gi = path.join(outDir, '.gitignore');
      if (!fs.existsSync(gi)) fs.writeFileSync(gi, '*\n!.gitignore\n', 'utf8');
    }
    process.exit(0);
  } catch (err) {
    console.error('[openapi-gen] 生成失败:', err instanceof Error ? err.message : err);
    if (verbose && err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  }
})();
