/**
 * 从用户项目里的本地 yaml + 远程 spec 生成多套独立运行时的 axios SDK。
 *
 * 设计目标:一个 yaml = 一套独立运行时(axios/settings/client),
 * 避免不同域名/Token/baseURL 相互覆盖。
 *
 * 输入:
 *   - 本地: <apiDir>/*.yaml(name = 文件名去后缀)
 *   - 远程: remotes[].url 下载到 <outDir>/.cache/remotes/<name>.yaml
 *
 * 输出:
 *   - <outDir>/index.ts             顶层 barrel,业务侧从这里 import
 *   - <outDir>/<name>-gen/          每个 spec 的独立运行时与 SDK
 *   - <outDir>/.cache.json          增量缓存
 *   - <outDir>/.cache/remotes/      远程下载落盘缓存
 */
import { createClient } from '@hey-api/openapi-ts';
import SwaggerParser from '@apidevtools/swagger-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCacheKey, canUseCache, listYamlFiles, writeCache } from './cache-utils.mjs';
import { patchGeneratedClientGen, writeClientsBarrel, writeGenWrappers } from './codegen-utils.mjs';
import { downloadRemoteSpec, loadCachedRemoteSpec, validateRemotes } from './remote-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, '..');

/**
 * 运行一次代码生成。
 *
 * @param {object} opts
 * @param {string}  opts.apiDir         本地 yaml 来源目录(绝对路径)
 * @param {string}  opts.outDir         生成产物目录(绝对路径)
 * @param {Array<{name:string,url:string,headers?:Record<string,string>,timeoutMs?:number}>} [opts.remotes]
 * @param {boolean} [opts.offline]      true 时跳过远程拉取,直接用 outDir/.cache/remotes 的快照
 * @param {boolean} [opts.verbose]
 * @returns {Promise<{ skipped: boolean; specs: string[] }>}
 */
export async function runGenerate({ apiDir, outDir, remotes = [], offline = false, verbose = false }) {
  const log = (...args) => console.log('[openapi-gen]', ...args);
  const debug = verbose ? log : () => {};

  // 1. 校验远程列表
  validateRemotes(remotes);

  // 2. 收集本地 entries
  const localFiles = listYamlFiles(apiDir);
  const localEntries = localFiles.map((p) => {
    const name = path.basename(p).replace(/\.ya?ml$/i, '');
    const st = fs.statSync(p);
    return { name, filePath: p, mtimeMs: st.mtimeMs, size: st.size };
  });

  // 3. 远程 spec:在线下载 or 离线读快照
  const remoteEntries = await Promise.all(
    remotes.map((remote) =>
      offline ? loadCachedRemoteSpec({ remote, outDir }) : downloadRemoteSpec({ remote, outDir, log: debug }),
    ),
  );

  // 4. 同名检测(本地 yaml name 与 remotes name 不能撞)
  const allEntries = [...localEntries, ...remoteEntries];
  if (allEntries.length === 0) {
    log(`没有任何 spec(apiDir=${path.relative(process.cwd(), apiDir)} 为空 且 remotes=[]),跳过生成`);
    return { skipped: true, specs: [] };
  }
  assertNoNameConflict(localEntries, remoteEntries);

  // 5. 缓存命中检查
  const httpSource = path.join(pkgRoot, 'scripts', 'http.ts');
  await fs.promises.mkdir(outDir, { recursive: true });
  const cachePath = path.join(outDir, '.cache.json');
  const cacheKey = buildCacheKey({
    cwd: process.cwd(),
    localEntries,
    remoteEntries,
    templateFile: httpSource,
  });

  if (canUseCache({ outDir, cachePath, cacheKey, allEntries })) {
    log('全部 spec 未变更,使用缓存(跳过 generate)');
    return { skipped: true, specs: allEntries.map((e) => e.name) };
  }

  // 6. 逐个生成
  for (const e of allEntries) {
    await generateOne({ entry: e.filePath, outDir, name: e.name, httpSource, debug });
    writeGenWrappers({ outDir, name: e.name });
  }

  // 7. 顶层 barrel + 缓存写入
  const names = allEntries.map((e) => e.name);
  writeClientsBarrel({ outDir, names });
  writeCache({ cachePath, cacheKey });

  log(
    `已生成 ${names.length} 个 spec(${localEntries.length} 本地 + ${remoteEntries.length} 远程) → ${path.relative(process.cwd(), outDir)}/`,
  );

  return { skipped: false, specs: names };
}

function assertNoNameConflict(localEntries, remoteEntries) {
  const localNames = new Set(localEntries.map((e) => e.name));
  for (const r of remoteEntries) {
    if (localNames.has(r.name)) {
      throw new Error(
        `spec 名称冲突: "${r.name}" 同时来自本地 yaml(${r.name}.yaml)与 remotes,请改名其中之一`,
      );
    }
  }
  // 远程之间的同名已经在 validateRemotes 里报错过
}

async function generateOne({ entry, outDir, name, httpSource, debug }) {
  const bundled = await SwaggerParser.bundle(entry);
  const dir = path.join(outDir, `${name}-gen`);

  await fs.promises.rm(dir, { recursive: true, force: true });

  await createClient({
    input: bundled,
    output: dir,
    plugins: ['@hey-api/client-axios'],
  });

  fs.copyFileSync(httpSource, path.join(dir, 'openapi-http.gen.ts'));

  patchGeneratedClientGen({ clientGenPath: path.join(dir, 'client.gen.ts') });

  const indexBarrel = path.join(dir, 'index.ts');
  if (fs.existsSync(indexBarrel)) fs.unlinkSync(indexBarrel);

  debug(`已生成 ${name}-gen(来源: ${path.relative(process.cwd(), entry)})`);
}
