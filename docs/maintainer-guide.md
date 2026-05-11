# 维护与发布指南

这份文档写给：**要改本仓库代码、发 npm 包、或配 GitHub 流水线的人**。

如果你只是想在**自己的业务项目**里用 `openapi-axios-sdk` 生成接口代码，请直接看仓库根目录的 [`README.md`](../README.md)，不用读本篇。

下面出现的 **`NPM_TOKEN`** 可以理解成：让 GitHub 的服务器代替你执行 `npm publish` 时用的「一把钥匙」，要在 npm 网站生成，再贴到 GitHub 仓库的 Secret 里（后文有步骤）。

下文记录：本仓库怎么自测、怎么发版、CI / Release 各自干什么。

## 自测命令

```bash
# 全量检查：类型 + lint + 格式 + 单测
pnpm check

# 仅构建
pnpm build

# 发布前 tarball 预检（不真正发布）
pnpm release:dry
```

当前脚本基线：

- `lint` → `oxlint`
- `fmt` / `fmt:check` → `oxfmt`
- `test` / `test:watch` → `vitest`
- `prepublishOnly` → `pnpm clean && pnpm check && pnpm build`

## 一次性准备

1. 克隆仓库并安装依赖

```bash
corepack enable
git clone https://github.com/Promisezhangbo/openapi-axios-sdk.git
cd openapi-axios-sdk
pnpm install
```

> 仓库通过 `package.json#packageManager` 锁定 `pnpm@10.33.4`（兼容 Node `>=20.19`）。

2. 登录 npm：`npm login`，确认 `npm whoami`。
3. 检查包名是否可用：`npm view openapi-axios-sdk`。

## 修改发布指南（简版）

1. 拉取最新代码
2. 修改代码
3. 检查测试代码（建议运行 `pnpm check`）
4. 更新版本号（`pnpm version patch|minor|major|<exact-version>`）
5. 提交代码到 GitHub（含 tag）
6. 更新 npm 包（`pnpm release`）

## 发布流程

```bash
# 1. 同步主分支 + 干净工作区
git switch main && git pull --rebase

# 2. 自测 + 构建
pnpm clean && pnpm check && pnpm build
ls dist/

# 3. 预检 tarball
pnpm release:dry
tar -tzf /tmp/openapi-axios-sdk-*.tgz | sort

# 4. 升版本（任选其一）
pnpm version patch
pnpm version minor
pnpm version major

# 或指定精确版本号（完全可以这样用）
pnpm version 1.0.1

# 如果你没有走 pnpm version（比如手动改了 package.json），
# 需要手动打 tag（tag 名建议带 v 前缀）
git tag -a v1.0.1 -m "release: v1.0.1"

# 5. 发布
pnpm release

# 6. 推 tag
git push --follow-tags
```

### 版本命令说明

- `pnpm version patch`：修复类发布，例如 `1.0.0 -> 1.0.1`
- `pnpm version minor`：新增兼容功能，例如 `1.0.0 -> 1.1.0`
- `pnpm version major`：不兼容变更，例如 `1.0.0 -> 2.0.0`
- `pnpm version 1.0.1`：直接指定目标版本号（可替代 patch/minor/major）

> `pnpm version ...` 默认会更新 `package.json` 并创建对应 git tag（如 `v1.0.1`）。
> 若你是手动改版本号，则必须手动 `git tag`，否则发布流程里的 tag 触发与版本追踪会缺失。

## 发布后验证

```bash
npm view openapi-axios-sdk versions
npm view openapi-axios-sdk dist-tags
```

可选本地冒烟：

```bash
mkdir /tmp/smoke && cd /tmp/smoke && npm init -y
pnpm add -D openapi-axios-sdk axios
pnpm dlx openapi-axios-sdk --help
pnpm dlx openapi-gen --help
```

## 回滚 / 弃用

| 场景               | 命令                                                        | 限制                                            |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| 误发小版本并需删除 | `npm unpublish openapi-axios-sdk@0.1.1`                     | 仅发布后 72 小时内                              |
| 标注弃用建议升级   | `npm deprecate openapi-axios-sdk@0.1.1 "use 0.1.2 instead"` | 任何时候可用                                    |
| 整包下线（不推荐） | `npm unpublish openapi-axios-sdk --force`                   | 仅 72 小时内；包名会受 npm 策略限制再次注册时间 |

建议优先 `deprecate`，尽量避免 `unpublish` 影响下游 lockfile。

## GitHub Actions

- CI：`.github/workflows/ci.yml`
- 发布：`.github/workflows/release.yml`

可以简单记：

- **CI**：别人提 PR、或往 `main` 推代码时，自动跑检查（相当于「进门安检」）。
- **Release**：要发 npm 包时跑；里面也会先跑一遍检查，**通过了才会真的 `publish`**，避免坏包发上去。

再细一点：

- **CI** 用 Node `20` 和 `22` 各跑一遍，脚本在 `.github/workflows/reusable-check.yml`。
- **Release** 里先调同一套检查（默认 Node `20`），成功后再 `pnpm publish`。推 `v*` 标签**不会**自动再跑一遍 CI（因为 CI 只盯着 `main` 和 PR）。若你希望「只有合并进 main 且全绿过的代码才打 tag」，要在 GitHub 里给 `main` 开**分支保护**，让合并前必须通过 CI。

发布工作流需要仓库 Secret：`NPM_TOKEN`。

触发方式：`v*` tag push（例如 `pnpm version patch` 后 `git push --follow-tags`）。

### `NPM_TOKEN` 怎么拿到、贴到哪（白话）

1. 用浏览器登录 [npmjs.com](https://www.npmjs.com/)，进入 **Access Tokens**（访问令牌）。
2. 新建 **Granular**（细粒度）或 **Automation** 类令牌，勾选能 **发布（publish）** 本包；若 npm 要求 2FA，按页面提示勾选「允许 CI 发布」一类选项（否则 GitHub 上会 403）。
3. 复制生成出来的**一长串字符**（只显示一次，丢了就删了重建）。
4. 打开 GitHub 上**本仓库** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**。
5. **Name** 填：`NPM_TOKEN`（必须和工作流里写的一致）。
6. **Value** 粘贴刚才复制的令牌 → 保存。

本地自己执行 `pnpm publish` 时，一般要在本机先 `npm login`，不需要配 GitHub Secret。

## GitHub 部署指南（手动触发发布）

可以，当前发布工作流已经支持 `workflow_dispatch`，可以在 GitHub 页面手动运行并在流水线末尾自动执行发布。

### 前置条件

1. 仓库已配置 `NPM_TOKEN`（有 npm publish 权限）
2. `main` 分支上的 `package.json#version` 是待发布的新版本（且 npm 上还不存在）
3. 代码已合并到目标分支（通常 `main`）

### 手动发布步骤（UI）

1. 打开 GitHub 仓库 → `Actions`
2. 选择 `Release` 工作流
3. 点击 `Run workflow`
4. Branch 选择 `main`
5. 点击确认运行
6. 等待流程完成：先跑复用的 **Check**（与 CI 同源步骤），成功后再 `pnpm install` + `pnpm publish`（`prepublishOnly` 仍会再跑 `clean + check + build`）。

### npm provenance（sigstore）

- npm 通过 GitHub Actions 发布并带 **`--provenance`** 时，要求**源仓库在 GitHub 上为 Public**。私有仓库会报 `422`（Unsupported GitHub Actions source repository visibility: "private"）。
- 若要保持**私有仓库**：不要加 `--provenance`（本仓库 Release 工作流已按此配置）。
- 若希望 npm 页面展示 provenance：把仓库改为 **Public**，并在 `pnpm publish` 中恢复 `--provenance`，同时为 job 赋予 `permissions.id-token: write`。

### 结果校验

发布成功后检查：

```bash
npm view openapi-axios-sdk versions
npm view openapi-axios-sdk dist-tags
```

### 常见注意事项

- 手动触发发布时，工作流不会自动帮你改版本号；版本号应提前在代码里更新并提交
- 如果该版本已存在，`pnpm publish` 会失败（这是正常保护）
- 若你希望发布记录和代码版本严格对齐，建议发布后补推 tag：`git push --follow-tags`

## 发布前 Checklist

- [ ] `pnpm check` 通过
- [ ] `pnpm build` 产出 `dist/*.js` 与 `dist/*.d.ts`
- [ ] `pnpm release:dry` tarball 清单无 `src/`
- [ ] `CHANGELOG.md` 与 release notes 已更新
- [ ] `npm whoami` 为可发布账号
- [ ] `repository` 可克隆；`bugs.email` / `author` 邮箱有效
