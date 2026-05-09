/**
 * 增量缓存:
 * - 本地 yaml 用 mtime+size 指纹(开发时频繁 touch 触发重生成)
 * - 远程 yaml 用 sha256 指纹(跨 CI / 跨机器都稳)
 * - cacheKey schema 版本 v2,旧 v1 自动失效
 */
import fs from 'node:fs';
import path from 'node:path';

export function listYamlFiles(apiDir) {
  if (!fs.existsSync(apiDir)) return [];
  return fs
    .readdirSync(apiDir)
    .filter((f) => /\.ya?ml$/i.test(f))
    .map((f) => path.join(apiDir, f))
    .sort();
}

function fileFingerprint(p) {
  const st = fs.statSync(p);
  return { mtimeMs: st.mtimeMs, size: st.size };
}

/**
 * 构造缓存指纹。
 *
 * @param {object} args
 * @param {string} args.cwd                   项目根目录(用于路径相对化)
 * @param {Array<{ name: string, filePath: string, mtimeMs: number, size: number }>} args.localEntries
 * @param {Array<{ name: string, url: string, sha256: string, size: number }>}        args.remoteEntries
 * @param {string} args.templateFile          http.ts 模板路径
 */
export function buildCacheKey({ cwd, localEntries, remoteEntries, templateFile }) {
  const local = localEntries.map((e) => ({
    source: 'local',
    name: e.name,
    path: path.relative(cwd, e.filePath),
    mtimeMs: e.mtimeMs,
    size: e.size,
  }));
  const remote = remoteEntries.map((e) => ({
    source: 'remote',
    name: e.name,
    url: e.url,
    sha256: e.sha256,
    size: e.size,
  }));
  // 按 name 排序,避免数组顺序变化导致 cache 误判
  const specs = [...local, ...remote].sort((a, b) => a.name.localeCompare(b.name));
  const template = { path: path.relative(cwd, templateFile), ...fileFingerprint(templateFile) };
  return { v: 2, specs, template };
}

/**
 * 判断能否命中缓存:
 *   - cacheKey 完全一致
 *   - outDir/index.ts barrel 在
 *   - 每个 spec 的 <name>-gen 目录都在
 *
 * @param {object} args
 * @param {string} args.outDir
 * @param {string} args.cachePath
 * @param {object} args.cacheKey
 * @param {Array<{ name: string }>} args.allEntries
 */
export function canUseCache({ outDir, cachePath, cacheKey, allEntries }) {
  if (!fs.existsSync(cachePath)) return false;

  const barrel = path.join(outDir, 'index.ts');
  if (!fs.existsSync(barrel)) return false;
  for (const e of allEntries) {
    const dir = path.join(outDir, `${e.name}-gen`);
    if (!fs.existsSync(dir)) return false;
  }

  try {
    const old = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return JSON.stringify(old) === JSON.stringify(cacheKey);
  } catch {
    return false;
  }
}

export function writeCache({ cachePath, cacheKey }) {
  try {
    fs.writeFileSync(cachePath, `${JSON.stringify(cacheKey, null, 2)}\n`, 'utf8');
  } catch {
    // ignore cache write failure
  }
}
