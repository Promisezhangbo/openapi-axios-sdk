/**
 * Axios 运行时模板(会被复制到每个 `<outDir>/<name>-gen/openapi-http.gen.ts`)。
 * 目的:每个 YAML 独立一套 axios/settings/client,不串 BASE/token/headers。
 *
 * 注意:该文件不在 npm 包构建中执行,仅作为模板被原样复制到生成目录,
 * 因此里面的 import 必须能在用户项目里被解析(只 import 'axios' 即可)。
 */
import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

type Headers = Record<string, string>;
type MaybeFn<T> = T | ((x: unknown) => T | Promise<T>);

/** 每个 spec 独立维护的"可变运行时配置"(被请求拦截器读取)。 */
export type OpenApiAuthState = {
  BASE: string;
  WITH_CREDENTIALS: boolean;
  TOKEN?: string | MaybeFn<string | undefined>;
  HEADERS?: Headers | MaybeFn<Headers | undefined>;
};

/** 运行时配置容器(`<name>-gen/index.ts` 会在初始化时写入这些字段)。 */
export const openApiSettings: OpenApiAuthState = {
  BASE: '',
  WITH_CREDENTIALS: false,
};

export type OpenApiErrorReporter = (e: unknown) => void;
export type OpenApiErrorHandlingOptions = { reporter?: OpenApiErrorReporter; debounceMs?: number };

// --- 全局错误上报(去抖) ---
let reporter: OpenApiErrorReporter | undefined;
let debounceMs = 200;
let pending: unknown;
let timer: ReturnType<typeof setTimeout> | undefined;

export function configureOpenApiErrorHandling(opts: OpenApiErrorHandlingOptions): void {
  reporter = opts.reporter;
  debounceMs = opts.debounceMs ?? 200;
  if (timer) clearTimeout(timer);
  timer = undefined;
  pending = undefined;
}

function report(error: unknown): void {
  if (!reporter) return;
  pending = error;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    const last = pending;
    pending = undefined;
    if (last !== undefined) {
      try {
        reporter!(last);
      } catch {
        /* ignore */
      }
    }
  }, debounceMs);
}

// --- axios 扩展:允许单次请求跳过全局错误上报 ---
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipGlobalErrorHandler?: boolean;
  }
}

/** 该 spec 专属的 axios 实例(SDK 的 client.gen 会被注入使用它)。 */
export const openApiHttpClient = axios.create();

// --- 静默区间:执行期间不触发全局 error reporter ---
let silent = 0;

export function openApiSilent<T>(fn: () => T | Promise<T>): Promise<T> {
  silent++;
  return Promise.resolve()
    .then(fn)
    .finally(() => silent--);
}

/**
 * 避免重复拼接 baseURL 导致路径重复。
 *
 * 导出主要用于本仓库 vitest 测试覆盖各种边界(同源/跨域/绝对 URL/前缀重复等),
 * 业务侧通常不需要直接调用。
 */
export function shouldApplyAxiosBaseURL(url: string, base: string): boolean {
  if (!url || /^https?:\/\//i.test(url) || !base) return false;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (/^https?:\/\//i.test(base)) {
    try {
      const p = new URL(base).pathname.replace(/\/$/, '');
      if (p && p !== '/' && (path === p || path.startsWith(`${p}/`))) return false;
    } catch {
      /* ignore */
    }
    return true;
  }
  const b = base.replace(/\/$/, '');
  if (!b) return true;
  return !(path === b || path.startsWith(`${b}/`));
}

/** 将 token/headers/baseURL/withCredentials 注入到每一次 axios 请求配置里。 */
async function applyAuth(config: InternalAxiosRequestConfig): Promise<void> {
  config.withCredentials = openApiSettings.WITH_CREDENTIALS;

  const url = config.url ?? '';
  if (shouldApplyAxiosBaseURL(url, openApiSettings.BASE)) {
    config.baseURL = openApiSettings.BASE;
  }

  if (!config.headers) config.headers = new AxiosHeaders();
  const h = config.headers instanceof AxiosHeaders ? config.headers : AxiosHeaders.from(config.headers);

  const tok = openApiSettings.TOKEN;
  const token = typeof tok === 'function' ? await tok(undefined) : tok;
  if (!h.get('Authorization') && typeof token === 'string' && token.length > 0) {
    h.set('Authorization', `Bearer ${token}`);
  }

  const hdrSrc = openApiSettings.HEADERS;
  const extra = typeof hdrSrc === 'function' ? await hdrSrc(undefined) : hdrSrc;
  if (extra && typeof extra === 'object') {
    for (const [k, v] of Object.entries(extra)) {
      if (v != null && (h.get(k) == null || h.get(k) === '')) h.set(k, String(v));
    }
  }
}

openApiHttpClient.interceptors.request.use(async (config) => {
  await applyAuth(config);
  config.skipGlobalErrorHandler = config.skipGlobalErrorHandler === true || silent > 0;
  return config;
});

openApiHttpClient.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const c = error.config as (InternalAxiosRequestConfig & { skipGlobalErrorHandler?: boolean }) | undefined;
    if (!c?.skipGlobalErrorHandler) report(error);
    return Promise.reject(error);
  },
);
