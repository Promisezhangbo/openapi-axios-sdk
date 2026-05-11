# 生成机制与设计说明

如果你**只想在业务项目里用这个工具**，请优先阅读仓库根目录的 [`README.md`](../README.md)。本篇偏**实现细节**，适合想读源码、排查生成问题、或准备给本仓库提 PR 的同学。

---

## 每次 `openapi-gen` 大致做了什么（按顺序）

可以把它想成一条流水线：读配置 → 找文档 → 必要时下载 → 校验名字不重复 → 看缓存要不要跳过 → 真正生成文件。

1. 读取项目根的配置文件 `openapi.config.{ts,mts,mjs,js,cjs}`（`.ts` 会用 `jiti` 加载）。
2. 扫描本地 `apiDir` 下的 `*.yaml` / `*.yml`。
3. 处理远程 `remotes`：
   - 正常联网：下载到 `<outDir>/.cache/remotes/<name>.yaml`。
   - 加了 `--offline`：不下载，直接用缓存文件。
4. 检查：本地和远程的 **名字不能重复**。
5. 看增量缓存：本地看文件修改时间+大小，远程看内容 hash，模板变了也会重生成。
6. 对每个 spec：解析引用 → 调生成器 → 拷贝 axios 模板 → 改 client → 写工厂函数。
7. 写最外层的 `index.ts`，把所有 spec 汇总导出。

## 和直接用 `@hey-api/openapi-ts` 差在哪（白话）

- 多份 API 文档时，**每份各自一套 axios 配置**，不会互相覆盖 baseURL / Token。
- 统一提供 **`OpenApi<名字>({ ... })`** 这种初始化方式。
- 自带**跳过未变更文档**的缓存，少跑重复生成。

## `OpenApiAuthState` 和拦截器（实现视角）

生成目录里的 `openApiSettings` 就是一份可变配置，类型叫 `OpenApiAuthState`，来自模板 `scripts/http.ts`。每次发请求前，拦截器会读里面的 `BASE`、`WITH_CREDENTIALS`、`TOKEN`、`HEADERS` 去改请求配置。

**业务侧怎么填这些值**，请看根目录 [`README.md`](../README.md) 里「配置文件」和「运行时初始化」两节（用白话和表格写的）。

## 本仓库目录长什么样（方便对号入座）

```text
openapi-axios-sdk/
├─ bin/openapi-gen.mjs          ← 命令行入口
├─ scripts/                     ← 生成逻辑 + http 模板
├─ src/                         ← 发布到 npm 的 TS 源码（编译进 dist）
└─ dist/                        ← 编译结果（发布用）
```

## 发到 npm 的包里会带什么

- 会带上：`bin/`、`scripts/`、`dist/`、`README.md`、`LICENSE`。
- **不会**把 `src/` 打进 npm 包（体积和对外 API 更可控）。

## 实践上的一些建议

- 业务项目里把 `openapi-gen` 绑在 `predev` / `prebuild` 上，省得忘记生成。
- **若生成目录被 git 忽略或不提交**：本地 `prebuild` 只在开发者机器上跑；**CI 里仍要在 `build` 前执行一次 `openapi-gen`**，否则流水线会缺文件编不过。详见根目录 [`README.md`](../README.md) 的 **「CI/CD：不提交生成代码时怎么办」**。
- CI 网络不稳可以用 `--offline`，但要先在本地或流水线里成功拉过一次远程文档（并保留 `.cache` 快照策略）。
- 不想把生成代码提交 git，可在配置里打开 `gitignore: true`（与上一条搭配使用）。
