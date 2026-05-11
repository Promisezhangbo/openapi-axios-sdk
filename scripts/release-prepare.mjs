#!/usr/bin/env node
/**
 * 发布前：先跑与 CI 同源的 `pnpm check`，再执行 `pnpm version …` 写入新版本（并走 npm 默认的 git 提交 / 打 tag，除非加了 --no-git-tag-version）。
 *
 * 用法：
 *   pnpm release:prepare patch
 *   pnpm release:prepare minor
 *   pnpm release:prepare major
 *   pnpm release:prepare 0.3.0
 *
 * 若只想升版本、跳过检查（不推荐）：
 *   pnpm version patch
 */
import { execSync } from 'node:child_process';
import process from 'node:process';

const level = process.argv[2];
if (!level) {
  console.error('usage: pnpm release:prepare <patch|minor|major|x.y.z>');
  process.exit(1);
}

const semver = /^\d+\.\d+\.\d+$/;
if (!['patch', 'minor', 'major'].includes(level) && !semver.test(level)) {
  console.error(`invalid argument: ${level} (use patch, minor, major, or x.y.z)`);
  process.exit(1);
}

execSync('pnpm check', { stdio: 'inherit' });
execSync(`pnpm version ${level}`, { stdio: 'inherit' });
