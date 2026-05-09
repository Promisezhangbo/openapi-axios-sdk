# 生成机制与设计说明

这份文档记录 `openapi-axios-sdk` 的实现机制与设计取舍，面向维护者和想深入了解行为的使用者。

## 每次 `openapi-gen` 的流程

1. 读取项目根配置 `openapi.config.{ts,mts,mjs,js,cjs}`（`.ts` 通过 `jiti` 解析）。
2. 收集本地 `apiDir/*.yaml`。
3. 处理远程 `remotes`：
   - 在线模式：拉取远程 spec，写入 `<outDir>/.cache/remotes/<name>.yaml`。
   - 离线模式：直接读取 `<outDir>/.cache/remotes/<name>.yaml`。
4. 校验命名冲突：本地与远程 `name` 不能重复。
5. 计算缓存指纹并判定是否跳过：
   - 本地用 `mtime + size`
   - 远程用内容 `sha256`
   - 模板文件 `scripts/http.ts` 也参与指纹
6. 对每个 spec 执行生成：
   - `@apidevtools/swagger-parser` 打平 `$ref`
   - `@hey-api/openapi-ts` 生成 `client/sdk/types`
   - 注入 `openapi-http.gen.ts` 模板
   - patch `client.gen.ts`，改为使用注入的 axios 实例
   - 写入 `<name>-gen/index.ts` 包装 `OpenApi<Name>` 工厂
7. 写 `outDir/index.ts` 聚合导出。

## 与 `@hey-api/openapi-ts` 的差异

- 多 spec 运行时隔离（每个 spec 一套 axios/settings/client）。
- 提供 `OpenApi<Name>` 工厂，统一初始化入参（`BASE` / `token` / `headers` / `WITH_CREDENTIALS` / `errorHandling`）。
- 内置增量缓存，减少重复生成。

## 核心目录

```text
openapi-axios-sdk/
├─ bin/openapi-gen.mjs
├─ scripts/
│  ├─ generate.mjs
│  ├─ codegen-utils.mjs
│  ├─ cache-utils.mjs
│  ├─ remote-utils.mjs
│  ├─ defaults.mjs
│  └─ http.ts
├─ src/
│  ├─ index.ts
│  ├─ runtime.ts
│  └─ config.ts
└─ dist/
```

## 产物与发布策略

- npm tarball 仅发布：
  - `bin/`
  - `scripts/`
  - `dist/`
  - `README.md`
  - `LICENSE`
- `src/` 不进 tarball（通过 `files` 白名单控制）。

这样做的目的：

- 保持消费者安装体积小
- 固定 ABI（消费者只依赖 `dist`）
- 降低源码细节暴露

## 推荐实践

- 业务项目建议在 `predev` / `prebuild` 调用 `openapi-gen`。
- 弱网 CI 场景可使用 `--offline` + 缓存快照。
- 若需要避免提交生成产物，可在配置中开启 `gitignore: true`。
