import { describe, expect, it } from 'vitest';
import { validateRemotes } from '../scripts/remote-utils.mjs';

describe('validateRemotes (CLI 与 generate 共用)', () => {
  it('null / undefined 视为空数组', () => {
    expect(validateRemotes(undefined)).toEqual([]);
    expect(validateRemotes(null)).toEqual([]);
  });

  it('合法配置原样返回', () => {
    const r = [{ name: 'blog', url: 'https://x/openapi.yaml' }];
    expect(validateRemotes(r)).toBe(r);
  });

  it('非数组报错', () => {
    expect(() => validateRemotes({} as unknown)).toThrowError(/必须是数组/);
  });

  it('每条必须含 url 与 name', () => {
    expect(() => validateRemotes([{ name: 'a' }] as unknown)).toThrowError(/url 必须是非空字符串/);
    expect(() => validateRemotes([{ url: 'https://x' }] as unknown)).toThrowError(/name 必须是非空字符串/);
  });

  it('url 必须是 http(s)', () => {
    expect(() => validateRemotes([{ name: 'a', url: 'ftp://x' }])).toThrowError(/http\(s\):\/\//);
  });

  it('name 必须以字母开头(数字 / _ / - 开头都被拒绝),与 README 文档一致', () => {
    expect(() => validateRemotes([{ name: '0blog', url: 'https://x' }])).toThrowError(/不合法/);
    expect(() => validateRemotes([{ name: '_blog', url: 'https://x' }])).toThrowError(/不合法/);
    expect(() => validateRemotes([{ name: '-blog', url: 'https://x' }])).toThrowError(/不合法/);
    expect(validateRemotes([{ name: 'a0', url: 'https://x' }])).toBeTruthy();
    expect(validateRemotes([{ name: 'a-b_c0', url: 'https://x' }])).toBeTruthy();
  });

  it('remotes 内 name 不能重复', () => {
    expect(() =>
      validateRemotes([
        { name: 'a', url: 'https://x' },
        { name: 'a', url: 'https://y' },
      ]),
    ).toThrowError(/重复/);
  });
});
