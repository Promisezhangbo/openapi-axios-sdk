/**
 * CLI / generate / config 共享的默认值与正则。
 *
 * 单一事实源:任何修改都集中在这里,避免多处漂移。
 *   - bin/openapi-gen.mjs       打印帮助 + 解析 CLI
 *   - scripts/generate.mjs      生成流水线
 *   - scripts/remote-utils.mjs  remote spec 校验
 *   - src/config.ts             公共配置类型(独立维护一份字面量,与此处保持一致)
 */

export const DEFAULT_API_DIR = 'api';
export const DEFAULT_OUT_DIR = 'src/generated/openapi';
export const DEFAULT_REMOTE_TIMEOUT_MS = 10_000;

/**
 * spec name 命名规则:必须以字母开头,只允许字母 / 数字 / `_` / `-`。
 *
 * 选择"字母开头"的原因:
 *   - PascalCase 后会拼成 `OpenApi<Name>` 工厂名,数字开头会得到 `OpenApi0Blog` 这种别扭名
 *   - 与 JS 标识符前缀习惯一致(便于读者理解)
 */
export const SPEC_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export const CONFIG_CANDIDATES = [
  'openapi.config.ts',
  'openapi.config.mts',
  'openapi.config.mjs',
  'openapi.config.js',
  'openapi.config.cjs',
];
