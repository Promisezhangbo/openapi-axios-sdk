/**
 * 代码生成器辅助:
 * - patchGeneratedClientGen: 把 Hey API 生成的 client.gen.ts 改造成使用我们注入的 axios 实例
 * - writeGenWrappers:        在每个 <name>-gen/ 下写入 index.ts / types.ts(包含 OpenApi<Name> 工厂)
 * - writeClientsBarrel:      在 outDir 顶层写入 index.ts barrel,聚合所有 OpenApi<Name> 工厂
 */
import fs from 'node:fs';
import path from 'node:path';

/** 发布到 npm 的包名,生成出来的代码会从这里 import 运行时。 */
const RUNTIME_IMPORT = 'openapi-axios-sdk/runtime';

export function toPascal(s) {
  return String(s)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join('');
}

export function patchGeneratedClientGen({ clientGenPath }) {
  let s = fs.readFileSync(clientGenPath, 'utf8');

  // 1. 清理已有的 openApiHttpClient import(老版本可能写的是 ../openapi-http,新版可能写的是 ./openapi-http.gen 加/不加 .js)
  s = s.replace(
    /^import \{ openApiHttpClient \} from ['"](?:\.\.\/openapi-http|\.\/openapi-http\.gen(?:\.js)?)['"];?\r?\n?/gm,
    '',
  );

  // 2. 注入 axios 实例 import,锚点是 hey-api 自己生成的 ClientOptions2 那行(兼容有/无 .js 后缀)
  const anchor = s.match(
    /^(import type \{ ClientOptions as ClientOptions2 \} from ['"]\.\/types\.gen(?:\.js)?['"];?)\r?\n/m,
  );
  if (!anchor) {
    throw new Error(
      `${clientGenPath} 找不到 ClientOptions2 锚点 import,可能是 @hey-api/openapi-ts 版本不兼容,请检查或提 issue`,
    );
  }
  s = s.replace(anchor[0], `${anchor[0]}import { openApiHttpClient } from './openapi-http.gen';\n`);

  // 3. 把 axios 实例塞进 createConfig:
  //    a) 有 servers/baseURL 时形如 createConfig({ baseURL: '...' })
  if (!s.includes('axios: openApiHttpClient')) {
    s = s.replace(
      /createConfig(?:<[^>]*>)?\(\{\s*baseURL:/,
      'createConfig<ClientOptions2>({ axios: openApiHttpClient, baseURL:',
    );
  }
  //    b) 无 servers 时形如 createConfig() 或 createConfig<...>()
  if (!s.includes('axios: openApiHttpClient')) {
    s = s.replace(
      /createClient\(createConfig(?:<[^>]*>)?\(\s*\)\)/,
      'createClient(createConfig<ClientOptions2>({ axios: openApiHttpClient }))',
    );
  }

  // 4. 兜底校验:patch 失败时尽早抛错,避免静默生成挂掉的代码
  if (!s.includes('axios: openApiHttpClient')) {
    throw new Error(`${clientGenPath} 注入 axios 实例失败,@hey-api/openapi-ts 生成结构可能已变,请提 issue`);
  }

  fs.writeFileSync(clientGenPath, s);
}

export function writeGenWrappers({ outDir, name }) {
  const pascal = toPascal(name);
  const genDir = path.join(outDir, `${name}-gen`);
  const indexPath = path.join(genDir, 'index.ts');
  const typesPath = path.join(genDir, 'types.ts');
  const fnName = `OpenApi${pascal}`;
  const initTypeName = `OpenApi${pascal}Init`;
  const resolveName = `resolveOpenApi${pascal}Base`;
  const cfgBaseName = `configureOpenApi${pascal}Base`;
  const cfgRtName = `configureOpenApi${pascal}ResponseType`;

  fs.writeFileSync(typesPath, `/** ${name} 文档生成的类型。 */\nexport type * from './types.gen';\n`, 'utf8');

  fs.writeFileSync(
    indexPath,
    `import type { ResponseType } from 'axios';\n` +
      `import { client } from './client.gen';\n` +
      `import * as sdk from './sdk.gen';\n` +
      `import {\n` +
      `  configureOpenApiErrorHandling,\n` +
      `  openApiSettings,\n` +
      `  type OpenApiAuthState,\n` +
      `  type OpenApiErrorHandlingOptions,\n` +
      `} from './openapi-http.gen';\n` +
      `import { createOpenApiInitializer, resolveBase, type OpenApiCommonInit } from '${RUNTIME_IMPORT}';\n\n` +
      `export type { ResponseType };\n\n` +
      `export type ${initTypeName} = Partial<Pick<OpenApiAuthState, 'BASE' | 'WITH_CREDENTIALS'>> & {\n` +
      `  pathPrefix?: string;\n` +
      `  defaultResponseType?: ResponseType;\n` +
      `  token?: string | (() => string | Promise<string | undefined> | undefined);\n` +
      `  headers?: OpenApiAuthState['HEADERS'];\n` +
      `  errorHandling?: OpenApiErrorHandlingOptions;\n` +
      `};\n\n` +
      `export function ${resolveName}(init: Pick<${initTypeName}, 'BASE' | 'pathPrefix'>): string | undefined {\n` +
      `  return resolveBase(init);\n` +
      `}\n\n` +
      `export function ${cfgBaseName}(baseURL: string, more?: { responseType?: ResponseType }): void {\n` +
      `  openApiSettings.BASE = baseURL;\n` +
      `  client.setConfig({ baseURL, ...more });\n` +
      `}\n\n` +
      `export function ${cfgRtName}(responseType: ResponseType): void {\n` +
      `  client.setConfig({ responseType });\n` +
      `}\n\n` +
      `const init = createOpenApiInitializer({\n` +
      `  sdk,\n` +
      `  client,\n` +
      `  settings: openApiSettings,\n` +
      `  configureErrorHandling: configureOpenApiErrorHandling,\n` +
      `});\n\n` +
      `/** ${name}.yaml 对应的 SDK；在子应用入口初始化 BASE/token（该 spec 可能没有 servers.baseURL）。 */\n` +
      `export function ${fnName}(initArg?: ${initTypeName}): typeof sdk {\n` +
      `  return init(initArg as OpenApiCommonInit);\n` +
      `}\n\n` +
      `export {\n` +
      `  configureOpenApiErrorHandling,\n` +
      `  openApiHttpClient,\n` +
      `  openApiSilent,\n` +
      `  type OpenApiAuthState,\n` +
      `  type OpenApiErrorHandlingOptions,\n` +
      `  type OpenApiErrorReporter,\n` +
      `} from './openapi-http.gen';\n\n` +
      `export { client as client${pascal} } from './client.gen';\n` +
      `export * from './sdk.gen';\n` +
      `export type * from './types';\n`,
    'utf8',
  );
}

export function writeClientsBarrel({ outDir, names }) {
  const outPath = path.join(outDir, 'index.ts');
  const lines = [
    `/**`,
    ` * AUTO-GENERATED by openapi-axios-sdk`,
    ` *`,
    ` * 业务侧从这里导入 OpenApi<Name> 工厂,例如:`,
    ` *   import { OpenApiBlog } from '<this-dir>';`,
    ` * 注意:本文件每次 generate 会被覆盖,请勿手改。`,
    ` */`,
    ``,
  ];

  for (const name of names) {
    const pascal = toPascal(name);
    const fn = `OpenApi${pascal}`;
    const init = `OpenApi${pascal}Init`;
    const resolve = `resolveOpenApi${pascal}Base`;
    const cfgBase = `configureOpenApi${pascal}Base`;
    const cfgRt = `configureOpenApi${pascal}ResponseType`;

    // 仅聚合"具名且不冲突"的初始化入口与其类型；不聚合 sdk/types/runtime,避免跨 spec 命名冲突。
    lines.push(`export { ${fn}, ${resolve}, ${cfgBase}, ${cfgRt} } from './${name}-gen/index';`);
    lines.push(`export type { ${init} } from './${name}-gen/index';`);
    lines.push('');
  }

  lines.push('');
  fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
}
