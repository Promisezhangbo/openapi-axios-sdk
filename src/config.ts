/**
 * `openapi-axios-sdk` 的工程配置。
 *
 * 通常通过项目根的 `openapi.config.{ts,mjs,js}` 默认导出。
 * 推荐写法：
 *
 * ```ts
 * import { defineConfig } from 'openapi-axios-sdk/config';
 *
 * export default defineConfig({
 *   apiDir: 'api',
 *   outDir: 'src/generated/openapi',
 *   remotes: [
 *     { url: 'https://example.com/blog/openapi.yaml', name: 'blog' },
 *   ],
 * });
 * ```
 */

/**
 * 远程 spec 配置:每条会拉取 URL 对应的 OpenAPI/Swagger YAML/JSON,
 * 然后生成一份 `<name>-gen/`,与本地文件流程一致。
 */
export type RemoteSpec = {
  /**
   * 远程 spec URL,支持 yaml / yml / json。
   * 必须返回 200,否则 generate 中止。
   */
  url: string;
  /**
   * 生成产物目录名,决定:
   *   - `<outDir>/<name>-gen/`
   *   - 业务侧 `OpenApi<Name>` 工厂的 Pascal 命名
   * 必须与本地 yaml 文件名(去后缀)互不冲突。
   *
   * 命名规则:`/^[A-Za-z][A-Za-z0-9_-]*$/` —— 必须以字母开头,只允许字母 / 数字 / `_` / `-`。
   */
  name: string;
  /** 可选请求头,用于内网鉴权或 UA 等。 */
  headers?: Record<string, string>;
  /** 可选请求超时(毫秒),默认 10000。 */
  timeoutMs?: number;
};

export type OpenApiGenConfig = {
  /**
   * 本地 YAML/JSON spec 来源目录,相对项目根。
   * 目录下的每个 `*.yaml` / `*.yml` 都会生成一份 `<name>-gen/`。
   * 与 `remotes` 至少需要其一不为空。
   * @default 'api'
   */
  apiDir?: string;
  /**
   * 生成产物目录,相对项目根。
   * 在该目录下会生成:
   *   - `index.ts`              统一聚合的 barrel,业务侧 import 这里
   *   - `<name>-gen/`           每个 spec 的独立运行时与 SDK
   *   - `.cache.json`           增量缓存,跳过未变更的 spec
   *   - `.cache/remotes/`       远程 spec 的最近一次下载快照(供 --offline 使用)
   * @default 'src/generated/openapi'
   */
  outDir?: string;
  /**
   * 远程 spec 列表。每条会被拉取后写入 `<outDir>/.cache/remotes/<name>.yaml`,
   * 然后与本地 spec 一起进入生成流水线。
   */
  remotes?: RemoteSpec[];
  /**
   * 是否在 outDir 下写入 `.gitignore`,把生成产物排除出 git。
   * 推荐配 `predev` / `prebuild` 在启动 / 构建前自动重生成。
   * @default false
   */
  gitignore?: boolean;
  /** 输出生成步骤详细日志。命令行 `--verbose` 也可开启。 */
  verbose?: boolean;
};

/** CLI 内部解析后用的形态:全部填了默认值。 */
export type ResolvedOpenApiGenConfig = Required<Pick<OpenApiGenConfig, 'apiDir' | 'outDir'>> & {
  remotes: RemoteSpec[];
  gitignore: boolean;
  verbose: boolean;
};

/** 配置文件入口工具:仅做类型推导,运行时直接返回。 */
export function defineConfig(c: OpenApiGenConfig): OpenApiGenConfig {
  return c;
}

/** 默认值。 */
export const DEFAULT_API_DIR = 'api';
export const DEFAULT_OUT_DIR = 'src/generated/openapi';
export const DEFAULT_REMOTE_TIMEOUT_MS = 10_000;
