import fs from 'fs';
import os from 'os';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS build script, not app code
const { readHighwater, writeHighwater } = require('../scripts/lib/build-highwater');

/**
 * The build-number high-water mark is what stops a second run, started before
 * App Store Connect has listed the build the first one just uploaded, from
 * handing Apple the same number again (-19232, after a full archive).
 */
describe('build high-water mark', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zbr-hw-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reads 0 when nothing has been recorded', () => {
    expect(readHighwater(root)).toBe(0);
  });

  it('round-trips a recorded number', () => {
    writeHighwater(root, 15);
    expect(readHighwater(root)).toBe(15);
  });

  it('never lowers an existing mark', () => {
    writeHighwater(root, 15);
    writeHighwater(root, 9);
    expect(readHighwater(root)).toBe(15);
  });

  it('ignores values that are not usable build numbers', () => {
    writeHighwater(root, 0);
    writeHighwater(root, -3);
    writeHighwater(root, Number.NaN);
    expect(readHighwater(root)).toBe(0);
  });

  it('treats a corrupt file as no record rather than throwing', () => {
    fs.mkdirSync(path.join(root, 'build', 'ios'), { recursive: true });
    fs.writeFileSync(path.join(root, 'build', 'ios', '.last-build-number'), 'not-a-number\n');
    expect(readHighwater(root)).toBe(0);
  });
});
