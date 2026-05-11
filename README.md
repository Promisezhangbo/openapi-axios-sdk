# openapi-axios-sdk

## 包的作用

**openapi-axios-sdk** 是业务项目里的**开发依赖**：根据 **OpenAPI 3.x / Swagger**（本地 yaml/json 或远程 URL）**自动生成**带完整 **TypeScript 类型** 的 **Axios 调用代码**。你在业务里 `import` 生成出的工厂与方法即可发请求，契约与文档一致；文档变更后重新生成即可同步代码侧。

**本包帮你做到：**

- **从文档到可调用代码**：路径、HTTP 方法、请求/响应体与 OpenAPI 对齐，少写手写 `axios` 样板和容易过时的类型。
- **多份 API 互不干扰**：每份 spec 有独立的 **BASE、鉴权、默认请求头**，适合多后端、多微服务同时对接。
- **贴近仓库里的用法**：`defineConfig` + `openapi.config.*`、命令行 **`openapi-gen`**；支持本地目录、多远程、生成缓存与离线拉文档等。

底层生成基于 **[@hey-api/openapi-ts](https://github.com/hey-api/openapi-ts)**；本包在其上补齐多 spec 运行时隔离、统一配置与 CLI，方便在真实工程里落地。

> 一句话：**把你的 API 文档变成 TypeScript 里能直接调用的 axios 函数**，还带完整类型提示；多份文档各自有地址、Token、请求头，互不影响。

[![npm version](https://img.shields.io/npm/v/openapi-axios-sdk?style=flat-square)](https://www.npmjs.com/package/openapi-axios-sdk)
[![downloads](https://img.shields.io/npm/dm/openapi-axios-sdk?style=flat-square)](https://www.npmjs.com/package/openapi-axios-sdk)
[![license](https://img.shields.io/npm/l/openapi-axios-sdk?style=flat-square)](./LICENSE)

- **npm 包名**：`openapi-axios-sdk`（开发依赖安装即可）
- **命令行工具名**：`openapi-gen`（在终端里敲这个来生成代码）

## 第一次用？按这三步想

1. **写配置**：告诉工具「API 文档在哪、生成到哪」→ 见下文 [配置文件](#配置文件-openapiconfig字段说明)。
2. **跑命令**：在项目根执行 `openapi-gen`（或你写在 `package.json` 里的脚本）→ 见 [运行代码生成](#运行代码生成)。
3. **在业务里用**：`import` 生成出来的工厂函数，再调具体接口 → 见 [类型](#类型使用方式) 与 [发请求](#请求使用方式)。

下面出现的 **spec** 可以理解成「一份 API 文档」：本地一个 yaml 算一份，远程一个 URL 也算一份，每一份会生成一套独立代码。

## 目录

1. [包的作用](#包的作用)
2. [安装](#安装)
3. [配置文件 `openapi.config`（字段说明）](#配置文件-openapiconfig字段说明)
4. [运行代码生成](#运行代码生成)
5. [生成产物与导入路径](#生成产物与导入路径)
6. [CI/CD：不提交生成代码时怎么办](#cicd不提交生成代码时怎么办)
7. [类型使用方式](#类型使用方式)
8. [请求使用方式](#请求使用方式)
9. [运行时初始化 `OpenApi<Name>({ ... })`（全部可传字段）](#运行时初始化-openapiname--全部可传字段)
10. [CLI](#cli)
11. [常见问题（新手）](#常见问题新手)
12. [延伸阅读](#延伸阅读)

---

## 安装

在项目里执行（`-D` 表示开发依赖，生成代码一般在开发/构建阶段跑）：

```bash
pnpm add -D openapi-axios-sdk
# 或
npm i -D openapi-axios-sdk
```

生成出来的代码会 **import axios**，所以业务项目还要自己装 axios：

```bash
pnpm add axios
```

想用 TypeScript 的类型提示，项目里需要有 TypeScript（建议 5.x 以上，和本包 `peerDependencies` 里写的一致即可）。

---

## 配置文件 `openapi.config`（字段说明）

### 文件放哪、长什么样

- 放在**业务项目的根目录**（和 `package.json` 同级那一层）。
- 文件名一般是 **`openapi.config.ts`**；也支持 `.mts`、`.mjs`、`.js`、`.cjs`，工具会按固定顺序自动找。
- 文件里要 **`export default` 一个配置对象**，并用 `defineConfig` 包一下（这样写会有类型提示）。

```ts
// openapi.config.ts
import { defineConfig } from 'openapi-axios-sdk/config';

export default defineConfig({
  apiDir: 'api',
  outDir: 'src/generated/openapi',
  remotes: [{ url: 'https://example.com/openapi.yaml', name: 'blog' }],
  gitignore: false,
  verbose: false,
});
```

### `defineConfig` 里都能写啥（逐项说明）

| 字段        | 类型             | 默认值                    | 白话说明                                                                                                                                                                                                         |
| ----------- | ---------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiDir`    | `string`         | `'api'`                   | 放**本地** API 文档的文件夹（相对项目根）。里面每个 `*.yaml` / `*.yml` 会生成一套代码，文件夹名不用写进配置里，**文件名（去掉后缀）**会变成后面的「名字」。至少要和下面的 `remotes` 二选一有东西，不能两个都空。 |
| `outDir`    | `string`         | `'src/generated/openapi'` | **生成结果写到哪里**（相对项目根）。里面会有一个大 `index.ts` 和多个 `<名字>-gen` 子文件夹。                                                                                                                     |
| `remotes`   | 数组             | `[]`                      | **从网上下**的 API 文档列表。每一项怎么写见下面「远程一条怎么配」。本地和远程的 **名字不能撞**。                                                                                                                 |
| `gitignore` | `true` / `false` | `false`                   | 设成 `true` 时，会在生成目录里放一个 `.gitignore`，这样**生成代码默认不提交 git**（适合每次现生成）。                                                                                                            |
| `verbose`   | `true` / `false` | `false`                   | 生成时是否打印很多日志；也可以在命令行加 `--verbose`。                                                                                                                                                           |

### 远程一条怎么配（`remotes` 里每一项）

| 字段        | 必填？ | 白话说明                                                                                                                                             |
| ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`       | 必填   | 文档地址，必须是 **http 或 https**，内容可以是 YAML 或 JSON。要能直接访问成功（一般返回 200）。                                                      |
| `name`      | 必填   | 给这份远程文档起个**英文短名**，会用来当文件夹名和代码里的工厂名。**必须字母开头**，只能字母、数字、`_`、`-`。不能和本地 yaml 去掉后缀后的名字一样。 |
| `headers`   | 可选   | 只有**下载这份文档**时用的请求头（比如内网要带 Token），不是业务接口请求头。                                                                         |
| `timeoutMs` | 可选   | 下载文档最多等多少毫秒，默认 `10000`（10 秒）。                                                                                                      |

---

## 运行代码生成

**第 1 步**：打开业务项目的 `package.json`，在 `"scripts"` 里加一行，例如：

```jsonc
{
  "scripts": {
    "gen:api": "openapi-gen",
  },
}
```

（可选）还可以在 `predev`、`prebuild` 里挂上，这样启动或打包前会自动生成。

**第 2 步**：在**项目根目录**打开终端执行：

```bash
pnpm gen:api
```

更多命令行参数见下文 [CLI](#cli)。

---

## 生成产物与导入路径

跑完以后，默认在 `outDir`（例如 `src/generated/openapi`）下面会看到类似结构：

```text
<outDir>/
├─ index.ts                    ← 推荐：从这里 import 各 API 的入口
├─ blog-gen/                     ← 其中 blog 是你在配置里起的「名字」
│  ├─ index.ts
│  ├─ types.ts
│  ├─ sdk.gen.ts、client.gen.ts、types.gen.ts、openapi-http.gen.ts …
├─ .cache.json
└─ .cache/remotes/blog.yaml      ← 远程文档会缓存一份，离线生成时用
```

文档里写的 `@/generated/openapi` 只是**举例**：你要在自己项目里配路径别名（Vite / Webpack 等），或者不用别名、写成 **`./src/generated/openapi`** 这种相对路径也可以，只要路径对就行。

---

## CI/CD：不提交生成代码时怎么办

你发现的情况是对的：**如果仓库里不提交生成出来的代码，而 CI 里又从来不跑 `openapi-gen`，那流水线里 `pnpm build` / `tsc` 会找不到那些 `import`，构建会直接失败**——不是「请求没效果」，而是**项目根本编不过**。

可以二选一（或组合）：

### 做法 A：把生成代码提交进 Git（最省心）

- 优点：CI 不用额外装生成步骤，和别的 TypeScript 项目一样 `install` → `build` 即可。
- 缺点：仓库里多一批自动生成的文件，合并时要习惯一下 diff。

适合：小团队、生成结果不大、希望流水线最简单。

### 做法 B：不提交，但 CI 里必须先跑一遍生成（和本地一样）

- 在 CI 里 **`pnpm install` 之后、`pnpm build`（或 `tsc`）之前** 执行一次 `pnpm gen:api`（或你起的脚本名）。
- 若用了 `openapi.config` 里的 **远程 `remotes`**：CI 要能访问那些 URL（可能要配密钥头；或改用下面「离线」）。
- 若 CI **不能联网拉远程**：先在能联网的环境生成一次，把 `outDir` 下的 **`.cache/`**（含远程快照）一并提交或做成 artifact；CI 里用 `openapi-gen --offline`（需事先有过缓存快照）。

GitHub Actions 上示意（按你项目脚本名改）：

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm gen:api # 或 pnpm exec openapi-gen；与 package.json 里一致即可
- run: pnpm build
```

**小结**：不提交生成代码 ≠ 可以不在 CI 生成；要么**提交产物**，要么**在流水线里生成**，二选一必须满足其一。

---

## 类型使用方式

| 你想做什么                                     | 可以怎么写（路径按你项目实际改）                                    |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| 拿到某个 API 的「工厂函数」、从汇总入口 import | `import { OpenApiBlog } from '@/generated/openapi'`                 |
| 只拿**数据结构**的类型（列表项、请求体等）     | `import type { XxxDto } from '@/generated/openapi/blog-gen/types'`  |
| 想给工厂函数的参数加类型                       | `import type { OpenApiBlogInit } from '@/generated/openapi'`        |
| 写 `openapi.config.ts` 时需要类型提示          | `import { defineConfig } from 'openapi-axios-sdk/config'`           |
| 进阶：和生成出来的运行时配置对齐               | `import type { OpenApiAuthState } from 'openapi-axios-sdk/runtime'` |

---

## 请求使用方式

整体就两步：

1. **先**调用 `OpenApi某个名字({ ... })`，得到一个对象（可以理解成「这一份 API 文档对应的所有接口函数」）。
2. **再**在这个对象上点方法名发请求。方法名、参数长什么样，**完全由你的 OpenAPI 文档决定**，所以要以生成出来的 **`sdk.gen.ts`** 为准（在对应 `<name>-gen` 文件夹里）。

返回值一般是 **Promise**，解构出 `data` 就是响应体（和 axios 习惯一致）。

```ts
import { OpenApiBlog } from '@/generated/openapi';

const blogApi = OpenApiBlog({
  BASE: import.meta.env.VITE_BLOG_BASE, // https://api.xxx.com
  token: () => localStorage.getItem('token') ?? '',
});

// 下面方法名、body 字段名请打开你项目里的 sdk.gen.ts 对照着改
const { data } = await blogApi.listBlogs({
  body: { request_id: crypto.randomUUID() },
});
```

---

## 运行时初始化 `OpenApi<Name>({ ... })`（全部可传字段）

下面用 **`OpenApiBlog`** 当例子（说明你的 spec 名字正好叫 `blog`）。别的文档会生成 **`OpenApiUser`**、**`OpenApiOrder`** 等，规则一样；参数类型名一般为 **`OpenApiBlogInit`** 这种（与 spec 名对应）。

| 参数                  | 类型               | 白话作用                                                                                                                                               |
| --------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `BASE`                | 字符串，可选       | 接口的根地址，例如 `https://api.xxx.com`。如果文档里已经写了 `servers`，可能已经有一个默认值，你这里可以覆盖。                                         |
| `pathPrefix`          | 字符串，可选       | 路径前缀，例如 `/v1`。如果和 `BASE` 一起写，会自动拼成「根地址 + 前缀」。                                                                              |
| `WITH_CREDENTIALS`    | 真/假，可选        | 要不要在跨域时带上 Cookie 一类凭证（对应 axios 的 `withCredentials`）。                                                                                |
| `token`               | 字符串或函数，可选 | 用来自动加登录 Token：只有当你给出的**不是空字符串**、且请求里还没写 `Authorization` 时，会自动加 `Bearer ...`。返回空字符串等于「这次不要带 Token」。 |
| `headers`             | 对象或函数，可选   | 每个请求**额外**带上的头；不会盖掉你在单次请求里已经设好的头。                                                                                         |
| `defaultResponseType` | 可选               | 默认把响应当成什么类型解析（如 `json`、`blob`），一般不用改。                                                                                          |
| `errorHandling`       | 可选               | 统一处理报错：`reporter` 是出错时要调用的函数，`debounceMs` 是合并多次报错的时间间隔（毫秒）。                                                         |

也可以什么都不传：`OpenApiBlog()`，那就用生成时的默认行为。

完整一点的例子（你可以删掉用不到的项）：

```ts
import { OpenApiBlog } from '@/generated/openapi';

export const blogApi = OpenApiBlog({
  BASE: 'https://api.example.com',
  pathPrefix: '/v1',
  WITH_CREDENTIALS: true,
  token: async () => localStorage.getItem('access_token') ?? '',
  headers: () => ({ 'X-Request-Id': crypto.randomUUID() }),
  defaultResponseType: 'json',
  errorHandling: {
    reporter: (err) => console.error('[blog-api]', err),
    debounceMs: 300,
  },
});
```

上面这些最终会写进生成目录里的 **`openapi-http.gen.ts`** 里的 **`openApiSettings`**（类型名 **`OpenApiAuthState`**）。想看「到底怎么加到请求上」，打开那个文件即可。

---

## CLI

在终端执行：

```bash
openapi-gen [选项]
```

| 选项                          | 白话说明                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| `-c` 或 `--config` 后面跟路径 | 指定用哪一个配置文件；不写的话会自动找 `openapi.config.ts` 等默认文件名。 |
| `--offline`                   | 不去网上下远程文档，用上次已经缓存下来的文件（CI 网络不好时有用）。       |
| `-v` 或 `--verbose`           | 打印更详细的日志。                                                        |
| `-h` 或 `--help`              | 看帮助说明。                                                              |

---

## 常见问题（新手）

**Q：提示找不到配置文件？**  
A：确认 `openapi.config.ts`（或支持的其它后缀）在**项目根目录**，且当前终端 `cd` 到了项目根再跑命令。

**Q：本地文档要放什么格式？**  
A：放在 `apiDir` 指向的文件夹里，扩展名 **`yaml` 或 `yml`** 才会被扫到。

**Q：`OpenApiBlog` 里的 `Blog` 哪来的？**  
A：来自你**文件名或远程 `name`**。例如 `blog.yaml` 或 `name: 'blog'` → 工厂名大致是 `OpenApi` + `Blog`（首字母大写）。

**Q：不知道接口函数叫什么？**  
A：打开对应 `<name>-gen/sdk.gen.ts`，里面导出的就是可调用的方法列表。

**Q：npm 上的 README 和 GitHub 上的不一样？**  
A：npm 页面展示的是**发包时打进包里的那份 README**；和仓库是否私有无关。点 `repository` 进 GitHub 若仓库私有，别人可能打不开链接，但 npm 上的说明仍能看到。

**Q：不提交生成代码，CI 也没跑 `openapi-gen`，线上会怎样？**  
A：一般会**构建失败**（缺少文件 / import 报错）。请看上文 [CI/CD：不提交生成代码时怎么办](#cicd不提交生成代码时怎么办)。

---

## 延伸阅读

- 文档索引（维护本仓库的同学）：[`docs/README.md`](./docs/README.md)
- 发版、CI、npm token 等：[`docs/maintainer-guide.md`](./docs/maintainer-guide.md)
- 生成过程偏技术说明：[`docs/implementation-notes.md`](./docs/implementation-notes.md)
- 版本更新记录：[`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT
