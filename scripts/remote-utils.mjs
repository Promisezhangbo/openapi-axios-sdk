/**
 * 远程 spec 下载与校验。
 *
 * 设计要点:
 * - 下载到 `<outDir>/.cache/remotes/<name>.yaml`,后续与本地文件走同一条生成流水线。
 * - 用文件 sha256 作为缓存指纹(mtime 跨 CI 不稳定,内容 hash 才精准)。
 * - 每次 generate 都会重新发起请求(强一致语义);若内容未变,sha256 不变 → 命中缓存跳过生成。
 * - 失败:fail-fast,直接抛错,不做"降级到旧缓存"的兜底。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_REMOTE_TIMEOUT_MS, SPEC_NAME_PATTERN } from './defaults.mjs';

/**
 * 校验 remotes 数组合法性。CLI 与 generate 共用同一处实现。
 *
 * @param {unknown} remotes
 * @returns {Array<{ name: string, url: string, headers?: Record<string,string>, timeoutMs?: number }>}
 */
export function validateRemotes(remotes) {
  if (remotes === undefined || remotes === null) return [];
  if (!Array.isArray(remotes)) {
    throw new Error(`remotes 配置必须是数组,当前类型: ${typeof remotes}`);
  }
  const seen = new Set();
  remotes.forEach((r, i) => {
    if (!r || typeof r !== 'object') {
      throw new Error(`remotes[${i}] 必须是对象`);
    }
    if (typeof r.url !== 'string' || !r.url) {
      throw new Error(`remotes[${i}].url 必须是非空字符串`);
    }
    if (!/^https?:\/\//i.test(r.url)) {
      throw new Error(`remotes[${i}].url 必须是 http(s):// 协议: ${r.url}`);
    }
    if (typeof r.name !== 'string' || !r.name) {
      throw new Error(`remotes[${i}].name 必须是非空字符串(决定 <name>-gen 目录与 OpenApi<Name> 工厂)`);
    }
    if (!SPEC_NAME_PATTERN.test(r.name)) {
      throw new Error(`remotes[${i}].name = "${r.name}" 不合法,必须以字母开头,只允许字母/数字/_/-`);
    }
    if (seen.has(r.name)) {
      throw new Error(`remotes 内 name 重复: ${r.name}`);
    }
    seen.add(r.name);
  });
  return remotes;
}

/**
 * 下载一个远程 spec 到 outDir/.cache/remotes/<name>.yaml。
 *
 * @param {object} args
 * @param {{ name: string, url: string, headers?: Record<string,string>, timeoutMs?: number }} args.remote
 * @param {string} args.outDir
 * @param {(...a: unknown[]) => void} [args.log]
 * @returns {Promise<{ name: string, url: string, filePath: string, sha256: string, size: number }>}
 */
export async function downloadRemoteSpec({ remote, outDir, log = () => {} }) {
  const cacheDir = path.join(outDir, '.cache', 'remotes');
  await fs.promises.mkdir(cacheDir, { recursive: true });

  const filePath = path.join(cacheDir, `${remote.name}.yaml`);
  const timeoutMs = remote.timeoutMs ?? DEFAULT_REMOTE_TIMEOUT_MS;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(remote.url, {
      headers: remote.headers,
      signal: ctrl.signal,
      redirect: 'follow',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 保留原 error 作为 cause,方便业务侧拿到底层网络异常做诊断。
    throw new Error(`远程 spec ${remote.name} 下载失败(${remote.url}): ${msg}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`远程 spec ${remote.name} 下载失败(${remote.url}): HTTP ${res.status} ${res.statusText}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(filePath, buf);

  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  log(`下载 remote ${remote.name} → ${path.relative(process.cwd(), filePath)}(${buf.length}B)`);

  return { name: remote.name, url: remote.url, filePath, sha256, size: buf.length };
}

/**
 * 离线模式:不发起请求,直接读 outDir/.cache/remotes/<name>.yaml 的快照。
 * 文件不存在时报错(必须先在线跑过一次)。
 *
 * @param {object} args
 * @param {{ name: string, url: string }} args.remote
 * @param {string} args.outDir
 * @returns {Promise<{ name: string, url: string, filePath: string, sha256: string, size: number }>}
 */
export async function loadCachedRemoteSpec({ remote, outDir }) {
  const filePath = path.join(outDir, '.cache', 'remotes', `${remote.name}.yaml`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `离线模式下 remote ${remote.name} 缓存不存在(${path.relative(process.cwd(), filePath)}),请先去掉 --offline 在线跑一次`,
    );
  }
  const buf = await fs.promises.readFile(filePath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  return { name: remote.name, url: remote.url, filePath, sha256, size: buf.length };
}
