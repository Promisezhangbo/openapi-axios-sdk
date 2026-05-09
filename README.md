# openapi-axios-sdk

> 把 OpenAPI / Swagger YAML 一键生成 axios SDK + TS 类型，支持多 spec 独立运行时（BASE / Token / Headers 互不污染）。

[![npm version](https://img.shields.io/npm/v/openapi-axios-sdk?style=flat-square)](https://www.npmjs.com/package/openapi-axios-sdk)
[![downloads](https://img.shields.io/npm/dm/openapi-axios-sdk?style=flat-square)](https://www.npmjs.com/package/openapi-axios-sdk)
[![license](https://img.shields.io/npm/l/openapi-axios-sdk?style=flat-square)](./LICENSE)

包名是 `openapi-axios-sdk`，CLI 命令是 `openapi-gen`。

## 安装

```bash
pnpm add -D openapi-axios-sdk
# 或
npm i -D openapi-axios-sdk
```

`axios` 是生成代码的运行时依赖，建议项目里安装：

```bash
pnpm add axios
```

## 快速开始

### 1) 新建配置文件

```ts
// openapi.config.ts
import { defineConfig } from 'openapi-axios-sdk/config';

export default defineConfig({
  apiDir: 'api',
  outDir: 'src/generated/openapi',
  remotes: [
    { url: 'https://example.com/api/openapi.yaml', name: 'blog' },
    {
      url: 'https://internal.example.com/user/api.yaml',
      name: 'user',
      headers: { Authorization: 'Bearer xxx' },
      timeoutMs: 15_000,
    },
  ],
});
```

> 本地 spec 和远程 spec 可以共存，`name` 不能重复。

### 2) 添加生成脚本

```jsonc
{
  "scripts": {
    "gen:api": "openapi-gen",
    "predev": "openapi-gen",
    "prebuild": "openapi-gen",
  },
}
```

### 3) 运行生成

```bash
pnpm gen:api
```

默认输出到 `src/generated/openapi/`，并自动生成聚合入口 `index.ts`。

### 4) 业务侧调用

```ts
import { OpenApiBlog } from '@/generated/openapi';

export const blogApi = OpenApiBlog({
  BASE: import.meta.env.VITE_BLOG_BASE,
  token: () => localStorage.getItem('t') ?? '',
  WITH_CREDENTIALS: true,
});

const { data } = await blogApi.listKnowledgeBases({
  body: { request_id: crypto.randomUUID() },
});
```

类型可单独导入：

```ts
import type { KnowledgeBaseListItem } from '@/generated/openapi/blog-gen/types';
```

## 配置项

| 字段        | 类型           | 默认值                    | 说明                          |
| ----------- | -------------- | ------------------------- | ----------------------------- |
| `apiDir`    | `string`       | `'api'`                   | 本地 yaml 目录（相对项目根）  |
| `outDir`    | `string`       | `'src/generated/openapi'` | 产物目录（相对项目根）        |
| `remotes`   | `RemoteSpec[]` | `[]`                      | 远程 spec 列表                |
| `gitignore` | `boolean`      | `false`                   | 是否在 outDir 写 `.gitignore` |
| `verbose`   | `boolean`      | `false`                   | 输出详细日志                  |

### `RemoteSpec`

| 字段        | 类型                     | 默认 / 必填 | 说明                                  |
| ----------- | ------------------------ | ----------- | ------------------------------------- |
| `url`       | `string`                 | **必填**    | 远程 yaml/json URL                    |
| `name`      | `string`                 | **必填**    | 决定 `<name>-gen/` 与 `OpenApi<Name>` |
| `headers`   | `Record<string, string>` | —           | 可选请求头                            |
| `timeoutMs` | `number`                 | `10_000`    | 请求超时（毫秒）                      |

`name` 命名规则：`/^[A-Za-z][A-Za-z0-9_-]*$/`（必须以字母开头）。

## CLI

```bash
openapi-gen [options]

Options:
  -c, --config <path>   指定配置文件路径（默认查找 openapi.config.{ts,mts,mjs,js,cjs}）
      --offline         跳过远程 spec 拉取，使用上次缓存快照
  -v, --verbose         详细日志
  -h, --help            帮助
```

## 更多文档

- 维护与发布指南：[`docs/maintainer-guide.md`](./docs/maintainer-guide.md)
- 生成机制与设计说明：[`docs/implementation-notes.md`](./docs/implementation-notes.md)
- 变更历史：[`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT
