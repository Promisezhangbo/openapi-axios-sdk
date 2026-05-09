import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildCacheKey, canUseCache, listYamlFiles, writeCache } from '../scripts/cache-utils.mjs';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oas-cache-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(p: string, body: string): string {
  const abs = path.join(tmp, p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}

describe('listYamlFiles', () => {
  it('支持 .yaml / .yml,大小写不敏感,且按字典序稳定排序', () => {
    const apiDir = path.join(tmp, 'api');
    fs.mkdirSync(apiDir);
    fs.writeFileSync(path.join(apiDir, 'b.yaml'), '');
    fs.writeFileSync(path.join(apiDir, 'a.YML'), '');
    fs.writeFileSync(path.join(apiDir, 'c.txt'), '');
    fs.writeFileSync(path.join(apiDir, 'README.md'), '');

    const files = listYamlFiles(apiDir).map((f) => path.basename(f));
    expect(files).toEqual(['a.YML', 'b.yaml']);
  });

  it('apiDir 不存在时返回空数组', () => {
    expect(listYamlFiles(path.join(tmp, 'nope'))).toEqual([]);
  });
});

describe('buildCacheKey', () => {
  it('生成的 key 含 v=2,specs 按 name 排序,远程含 sha256', () => {
    const t = writeFile('http.ts', 'tpl');
    const local = writeFile('api/blog.yaml', 'l: 1');
    const localSt = fs.statSync(local);
    const key = buildCacheKey({
      cwd: tmp,
      localEntries: [
        {
          name: 'blog',
          filePath: local,
          mtimeMs: localSt.mtimeMs,
          size: localSt.size,
        },
      ],
      remoteEntries: [{ name: 'aaa', url: 'https://x', sha256: 'deadbeef', size: 3 }],
      templateFile: t,
    });
    expect(key.v).toBe(2);
    expect(key.specs.map((s) => s.name)).toEqual(['aaa', 'blog']);
    expect(key.specs[0]).toMatchObject({ source: 'remote', sha256: 'deadbeef' });
    expect(key.specs[1]).toMatchObject({ source: 'local', name: 'blog' });
    expect(key.template.path).toBe('http.ts');
  });

  it('远程列表顺序不影响 key 内容(已排序)', () => {
    const t = writeFile('http.ts', 'tpl');
    const k1 = buildCacheKey({
      cwd: tmp,
      localEntries: [],
      remoteEntries: [
        { name: 'a', url: 'u1', sha256: 's1', size: 1 },
        { name: 'b', url: 'u2', sha256: 's2', size: 1 },
      ],
      templateFile: t,
    });
    const k2 = buildCacheKey({
      cwd: tmp,
      localEntries: [],
      remoteEntries: [
        { name: 'b', url: 'u2', sha256: 's2', size: 1 },
        { name: 'a', url: 'u1', sha256: 's1', size: 1 },
      ],
      templateFile: t,
    });
    expect(JSON.stringify(k1.specs)).toBe(JSON.stringify(k2.specs));
  });
});

describe('canUseCache', () => {
  it('cache 文件 + outDir/index.ts + <name>-gen 全在,且 key 一致 → 命中', () => {
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.ts'), 'barrel');
    fs.mkdirSync(path.join(outDir, 'blog-gen'));
    const cachePath = path.join(outDir, '.cache.json');
    const cacheKey = { v: 2, specs: [], template: { path: 'http.ts' } };
    writeCache({ cachePath, cacheKey });

    expect(
      canUseCache({
        outDir,
        cachePath,
        cacheKey,
        allEntries: [{ name: 'blog' }],
      }),
    ).toBe(true);
  });

  it('某个 <name>-gen 缺失 → 不命中', () => {
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.ts'), 'barrel');
    const cachePath = path.join(outDir, '.cache.json');
    const cacheKey = { v: 2, specs: [], template: { path: 'http.ts' } };
    writeCache({ cachePath, cacheKey });

    expect(
      canUseCache({
        outDir,
        cachePath,
        cacheKey,
        allEntries: [{ name: 'blog' }],
      }),
    ).toBe(false);
  });

  it('cacheKey 不一致 → 不命中', () => {
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.ts'), 'barrel');
    fs.mkdirSync(path.join(outDir, 'blog-gen'));
    const cachePath = path.join(outDir, '.cache.json');
    writeCache({ cachePath, cacheKey: { v: 2, specs: [], template: { path: 'old' } } });

    expect(
      canUseCache({
        outDir,
        cachePath,
        cacheKey: { v: 2, specs: [], template: { path: 'new' } },
        allEntries: [{ name: 'blog' }],
      }),
    ).toBe(false);
  });

  it('cache 文件不存在 → 不命中', () => {
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(outDir);
    expect(
      canUseCache({
        outDir,
        cachePath: path.join(outDir, '.cache.json'),
        cacheKey: {},
        allEntries: [],
      }),
    ).toBe(false);
  });
});
