/**
 * `openapi-axios-sdk` 主入口。
 *
 * - 业务侧通常**不直接**从这里导入,而是从生成产物的 barrel
 *   （默认 `src/generated/openapi`）导入 `OpenApi<Name>` 工厂函数。
 * - 这里只导出运行时辅助类型与 `defineConfig`,供生成模板与配置文件使用。
 */
export * from './runtime.js';
export * from './config.js';
