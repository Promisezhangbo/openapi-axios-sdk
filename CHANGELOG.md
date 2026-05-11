# Changelog

这里只记**每个版本改了什么**。第一次使用、怎么配置、怎么调接口，请看根目录 [`README.md`](./README.md)（写给新手按步骤操作）。

## Unreleased

## 0.1.0

`2026-05-09`

- 🚀 feat: 首次发布 `openapi-axios-sdk`
- 🚀 feat: 支持多 spec 独立运行时（每个 yaml 独立 axios / settings / client，BASE / token / headers 互不污染）
- 🚀 feat: 支持本地 + 远程 spec 统一生成，远程内容基于 sha256 做增量缓存
- 🚀 feat: 支持 `--offline` 模式，弱网或离线场景可直接使用缓存快照
- 🚀 feat: 提供 `defineConfig` + `openapi-gen` CLI
- 🚀 feat: 内置 axios 拦截器能力（token 注入 / 全局错误上报去抖 / `openApiSilent`）
