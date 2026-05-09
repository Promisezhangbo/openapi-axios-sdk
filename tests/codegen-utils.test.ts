import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  patchGeneratedClientGen,
  toPascal,
  writeClientsBarrel,
  writeGenWrappers,
} from '../scripts/codegen-utils.mjs';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oas-codegen-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('toPascal', () => {
  it('把 kebab / snake / 数字混合都转成 PascalCase', () => {
    expect(toPascal('blog')).toBe('Blog');
    expect(toPascal('my-api')).toBe('MyApi');
    expect(toPascal('user_v2')).toBe('UserV2');
    expect(toPascal('  foo--bar__baz  ')).toBe('FooBarBaz');
  });
});

/**
 * patchGeneratedClientGen 的两个分支:
 *  a) 有 servers/baseURL 时:`createConfig({ baseURL: '...' })`
 *  b) 无 servers 时:`createConfig<...>()` / `createConfig()`
 *
 * 这里用最小可工作的 client.gen.ts 字符串覆盖两种形态,确认 patch 后:
 *  - 原本的 openApiHttpClient import 被清理
 *  - 注入了 './openapi-http.gen' 的 import
 *  - createConfig 第一个参数里多了 `axios: openApiHttpClient`
 */
describe('patchGeneratedClientGen', () => {
  function setup(content: string): string {
    const p = path.join(tmp, 'client.gen.ts');
    fs.writeFileSync(p, content);
    patchGeneratedClientGen({ clientGenPath: p });
    return fs.readFileSync(p, 'utf8');
  }

  const ANCHOR = `import type { ClientOptions as ClientOptions2 } from './types.gen';\n`;

  it('分支 a:有 baseURL 时正确注入 axios', () => {
    const out = setup(
      `${ANCHOR}` +
        `import { createClient, createConfig } from '@hey-api/client-axios';\n` +
        `export const client = createClient(createConfig({ baseURL: 'https://api.x.com' }));\n`,
    );
    expect(out).toContain(`import { openApiHttpClient } from './openapi-http.gen';`);
    expect(out).toMatch(/createConfig<ClientOptions2>\(\{\s*axios: openApiHttpClient,\s*baseURL:/);
  });

  it('分支 b:无 servers 时正确注入 axios', () => {
    const out = setup(
      `${ANCHOR}` +
        `import { createClient, createConfig } from '@hey-api/client-axios';\n` +
        `export const client = createClient(createConfig<ClientOptions2>());\n`,
    );
    expect(out).toContain(`import { openApiHttpClient } from './openapi-http.gen';`);
    expect(out).toContain('createClient(createConfig<ClientOptions2>({ axios: openApiHttpClient }))');
  });

  it('幂等性:多次 patch 不会重复注入(第二次仍包含且只有一处 axios: openApiHttpClient)', () => {
    const p = path.join(tmp, 'client.gen.ts');
    fs.writeFileSync(
      p,
      `${ANCHOR}` +
        `import { createClient, createConfig } from '@hey-api/client-axios';\n` +
        `export const client = createClient(createConfig({ baseURL: 'https://api.x.com' }));\n`,
    );
    patchGeneratedClientGen({ clientGenPath: p });
    patchGeneratedClientGen({ clientGenPath: p });
    const out = fs.readFileSync(p, 'utf8');
    const matches = out.match(/axios: openApiHttpClient/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('清理旧的 openApiHttpClient import:含 .js 后缀也能匹配', () => {
    const out = setup(
      `import { openApiHttpClient } from './openapi-http.gen.js';\n` +
        `${ANCHOR}` +
        `import { createClient, createConfig } from '@hey-api/client-axios';\n` +
        `export const client = createClient(createConfig({ baseURL: 'https://api.x.com' }));\n`,
    );
    // 只剩注入版本(无 .js 后缀),旧的应被替换掉
    const importLines = out.split('\n').filter((l) => l.includes(`'./openapi-http.gen`));
    expect(importLines).toHaveLength(1);
    expect(importLines[0]).toContain(`'./openapi-http.gen'`);
  });

  it('找不到 ClientOptions2 锚点时抛错,提示 hey-api 版本不兼容', () => {
    const p = path.join(tmp, 'client.gen.ts');
    fs.writeFileSync(p, `// 没有 ClientOptions2 import\nexport const client = {};\n`);
    expect(() => patchGeneratedClientGen({ clientGenPath: p })).toThrowError(/锚点|不兼容/);
  });
});

describe('writeGenWrappers + writeClientsBarrel', () => {
  it('写出的 index.ts / types.ts / barrel 内容含预期的 OpenApi<Pascal> 标识', () => {
    const outDir = path.join(tmp, 'out');
    fs.mkdirSync(path.join(outDir, 'my-api-gen'), { recursive: true });
    writeGenWrappers({ outDir, name: 'my-api' });

    const indexTs = fs.readFileSync(path.join(outDir, 'my-api-gen', 'index.ts'), 'utf8');
    expect(indexTs).toContain('export function OpenApiMyApi');
    expect(indexTs).toContain('export type OpenApiMyApiInit');
    expect(indexTs).toContain(`from 'openapi-axios-sdk/runtime'`);

    writeClientsBarrel({ outDir, names: ['my-api', 'user'] });
    const barrel = fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8');
    expect(barrel).toContain(
      `export { OpenApiMyApi, resolveOpenApiMyApiBase, configureOpenApiMyApiBase, configureOpenApiMyApiResponseType } from './my-api-gen/index';`,
    );
    expect(barrel).toContain(`export type { OpenApiMyApiInit } from './my-api-gen/index';`);
    expect(barrel).toContain(`export { OpenApiUser,`);
  });
});
