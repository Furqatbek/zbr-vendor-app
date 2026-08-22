import { isSafeExternalUrl } from '../utils/urlSafety';

describe('isSafeExternalUrl', () => {
  it('accepts public https URLs', () => {
    expect(isSafeExternalUrl('https://restos.example.com')).toBe(true);
    expect(isSafeExternalUrl('https://api.partner.io:8080/base')).toBe(true);
    expect(isSafeExternalUrl('  https://menu.zbr.uz  ')).toBe(true);
  });

  it('rejects cleartext http — the backend fetches this URL with the API key attached', () => {
    expect(isSafeExternalUrl('http://api.partner.io:8080/base')).toBe(false);
    expect(isSafeExternalUrl('http://restos.example.com')).toBe(false);
  });

  it('rejects non-https schemes', () => {
    expect(isSafeExternalUrl('ftp://example.com')).toBe(false);
    expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isSafeExternalUrl('')).toBe(false);
    expect(isSafeExternalUrl('not a url')).toBe(false);
    expect(isSafeExternalUrl('example.com')).toBe(false); // no scheme
  });

  it('rejects internal / metadata / private hosts (SSRF targets)', () => {
    expect(isSafeExternalUrl('http://localhost:8080')).toBe(false);
    expect(isSafeExternalUrl('http://127.0.0.1')).toBe(false);
    expect(isSafeExternalUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeExternalUrl('http://10.0.0.5')).toBe(false);
    expect(isSafeExternalUrl('http://192.168.1.1')).toBe(false);
    expect(isSafeExternalUrl('http://172.16.0.1')).toBe(false);
    expect(isSafeExternalUrl('http://admin.internal')).toBe(false);
    expect(isSafeExternalUrl('http://db.local')).toBe(false);
  });
});
