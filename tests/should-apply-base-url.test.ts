import { describe, expect, it } from 'vitest';
import { shouldApplyAxiosBaseURL } from '../scripts/http.ts';

/**
 * `shouldApplyAxiosBaseURL` 的语义:
 * - 当 url 已经是绝对 URL 时,axios 不应再加 baseURL
 * - 当 base 为空时,无需加 baseURL
 * - 当 url 已经以 base 的 path 部分开头时,不能重复拼(否则 `/api/api/foo`)
 */
describe('shouldApplyAxiosBaseURL', () => {
  it('返回 false 当 url 是绝对 http URL', () => {
    expect(shouldApplyAxiosBaseURL('https://other.com/x', 'https://api.example.com')).toBe(false);
    expect(shouldApplyAxiosBaseURL('http://x', 'https://api.example.com/api')).toBe(false);
  });

  it('返回 false 当 url 为空或 base 为空', () => {
    expect(shouldApplyAxiosBaseURL('', 'https://api.example.com')).toBe(false);
    expect(shouldApplyAxiosBaseURL('/users', '')).toBe(false);
  });

  it('完整 URL base + 仅域名 path 时:任意业务路径都需要拼 base', () => {
    expect(shouldApplyAxiosBaseURL('/users', 'https://api.example.com')).toBe(true);
    expect(shouldApplyAxiosBaseURL('users', 'https://api.example.com')).toBe(true);
    expect(shouldApplyAxiosBaseURL('/users', 'https://api.example.com/')).toBe(true);
  });

  it('完整 URL base + 含 path 前缀时:url 已带前缀则不再拼', () => {
    const base = 'https://api.example.com/api';
    expect(shouldApplyAxiosBaseURL('/api/users', base)).toBe(false);
    expect(shouldApplyAxiosBaseURL('/api', base)).toBe(false);
    expect(shouldApplyAxiosBaseURL('/users', base)).toBe(true);
  });

  it('相对 base (同源场景):url 已带前缀则不再拼', () => {
    expect(shouldApplyAxiosBaseURL('/api/users', '/api')).toBe(false);
    expect(shouldApplyAxiosBaseURL('/api', '/api')).toBe(false);
    expect(shouldApplyAxiosBaseURL('/api/', '/api/')).toBe(false);
    expect(shouldApplyAxiosBaseURL('/users', '/api')).toBe(true);
  });

  it('防 false-positive:`/apiv2` 不应被识别为 `/api` 前缀的 url', () => {
    // shouldApplyAxiosBaseURL 实现里要求 path === b 或 path.startsWith(`${b}/`)
    expect(shouldApplyAxiosBaseURL('/apiv2/users', '/api')).toBe(true);
    expect(shouldApplyAxiosBaseURL('/apiv2/users', 'https://api.example.com/api')).toBe(true);
  });
});
