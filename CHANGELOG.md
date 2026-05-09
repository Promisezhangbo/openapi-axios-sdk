# Changelog

按版本记录关键变更。

## Unreleased

## 0.1.0

`2026-05-09`

- 🚀 feat: 首次发布 `openapi-axios-sdk`
- 🚀 feat: 支持多 spec 独立运行时（每个 yaml 独立 axios / settings / client，BASE / token / headers 互不污染）
- 🚀 feat: 支持本地 + 远程 spec 统一生成，远程内容基于 sha256 做增量缓存
- 🚀 feat: 支持 `--offline` 模式，弱网或离线场景可直接使用缓存快照
- 🚀 feat: 提供 `defineConfig` + `openapi-gen` CLI
- 🚀 feat: 内置 axios 拦截器能力（token 注入 / 全局错误上报去抖 / `openApiSilent`）
