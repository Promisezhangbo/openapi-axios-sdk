import type { ResponseType } from 'axios';

/**
 * 每个 spec 的"运行时可变配置"。每个 `*-gen/openapi-http.gen.ts` 都维护一份独立实例。
 *
 * 命名与生成模板 (`scripts/http.ts`) 中的 `OpenApiAuthState` 保持一致,避免业务侧
 * 同时面对两个结构相同的不同名字。
 */
export type OpenApiAuthState = {
  BASE: string;
  WITH_CREDENTIALS: boolean;
  TOKEN?: string | ((x: unknown) => string | Promise<string | undefined> | undefined);
  HEADERS?:
    | Record<string, string>
    | ((x: unknown) => Record<string, string> | Promise<Record<string, string> | undefined> | undefined);
};

/** 全局错误上报(由 `openapi-http.gen.ts` 实现;这里仅透传配置结构)。 */
export type OpenApiErrorHandlingOptions = { reporter?: (e: unknown) => void; debounceMs?: number };

/**
 * 统一的初始化入参形态:各 `*-gen/index.ts` 都会把它映射成 `<OpenApiXxxInit>`。
 * 目的:多 YAML 场景下保持初始化语义一致(BASE/token/headers/responseType 等)。
 */
export type OpenApiCommonInit = Partial<Pick<OpenApiAuthState, 'BASE' | 'WITH_CREDENTIALS'>> & {
  pathPrefix?: string;
  defaultResponseType?: ResponseType;
  token?: string | (() => string | Promise<string | undefined> | undefined);
  headers?: OpenApiAuthState['HEADERS'];
  errorHandling?: OpenApiErrorHandlingOptions;
};

/**
 * 计算最终 baseURL:支持把网关前缀拼到 BASE 后(自动处理斜杠)。
 * - 跨域:传完整 BASE(含协议域名端口)更稳
 * - 同源:可只传 pathPrefix(例如 `/api`)
 */
export function resolveBase(init: Pick<OpenApiCommonInit, 'BASE' | 'pathPrefix'>): string | undefined {
  const { BASE, pathPrefix } = init;
  if (BASE !== undefined && pathPrefix !== undefined) {
    const a = BASE.replace(/\/$/, '');
    const b = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;
    return `${a}${b}`;
  }
  if (BASE !== undefined) return BASE;
  if (pathPrefix !== undefined) return pathPrefix;
  return undefined;
}

/**
 * 生成每个 `<name>-gen/index.ts` 里的 `OpenApi<Name>` 工厂函数。
 * 关键点:把"初始化逻辑"抽到公共函数里复用,避免每个 spec 复制一份。
 */
export function createOpenApiInitializer<TSdk>(deps: {
  /** 该 spec 的 SDK(`sdk.gen.ts` 全量导出对象) */
  sdk: TSdk;
  /** 该 spec 的 Hey API client(用于写入 baseURL/withCredentials/responseType 等) */
  client: {
    setConfig: (c: { baseURL?: string; withCredentials?: boolean; responseType?: ResponseType }) => void;
    getConfig: () => { baseURL?: unknown };
  };
  /** 该 spec 的运行时 settings(来自注入的 `openapi-http.gen.ts`) */
  settings: OpenApiAuthState;
  /** 可选:对接全局错误上报设置(来自注入的 `openapi-http.gen.ts`) */
  configureErrorHandling?: (opts: OpenApiErrorHandlingOptions) => void;
}) {
  const { sdk, client, settings, configureErrorHandling } = deps;

  // 初始 baseURL:若 spec 自带 `servers.url`,Hey API 会把它写进 client config,
  // 这里同步到 settings 里供 axios 拦截器使用。
  const fromSpec = client.getConfig().baseURL;
  if (typeof fromSpec === 'string' && fromSpec.length > 0) {
    settings.BASE = fromSpec;
  }

  return function initSdk(init?: OpenApiCommonInit): TSdk {
    if (!init) return sdk;
    const { token, headers, WITH_CREDENTIALS, errorHandling, defaultResponseType, ...rest } = init;
    const base = resolveBase(rest);

    const patch: { baseURL?: string; withCredentials?: boolean; responseType?: ResponseType } = {};
    if (base !== undefined) {
      settings.BASE = base;
      patch.baseURL = base;
    }
    if (WITH_CREDENTIALS !== undefined) {
      settings.WITH_CREDENTIALS = WITH_CREDENTIALS;
      patch.withCredentials = WITH_CREDENTIALS;
    }
    if (defaultResponseType !== undefined) {
      patch.responseType = defaultResponseType;
    }
    if (Object.keys(patch).length > 0) {
      client.setConfig(patch);
    }

    if (token !== undefined) {
      // 把 init.token (可能返回 undefined) 适配成 settings.TOKEN 始终返回 string 的形态;
      // undefined → '' 是有意行为:与 http.ts 里 `token.length > 0 才设 Authorization` 的逻辑配合,
      // 表示"用户暂未登录,本次请求不带 Authorization"。
      settings.TOKEN = typeof token === 'function' ? async () => (await token()) ?? '' : token;
    }
    if (headers !== undefined) settings.HEADERS = headers;

    if (errorHandling !== undefined && configureErrorHandling) configureErrorHandling(errorHandling);
    return sdk;
  };
}
