import { compareVersions, isOlderThan, isValidVersion } from '../utils/semver';
import { decideUpdateState } from '../hooks/useVersionCheck';

jest.mock('../services/api', () => ({ fetchAppVersion: jest.fn() }));
// The hook module pulls in AsyncStorage, which has no native module under Jest.
// decideUpdateState is pure and needs none of it.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../constants/appVersion', () => ({ APP_VERSION: '1.0.1', APP_BUILD: '13' }));

describe('compareVersions', () => {
  it('orders by numeric component, not lexically', () => {
    // The whole reason this module exists: "1.10.0" < "1.9.0" as strings, so a
    // string comparison silently stops offering updates at a two-digit minor.
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
  });

  it('treats equal versions as equal', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('pads missing components with zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
  });

  it('ignores build metadata', () => {
    expect(compareVersions('1.2.3+build.42', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3+a', '1.2.3+b')).toBe(0);
  });

  it('tolerates a leading v', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
  });

  it('ranks a prerelease below its release', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0-beta')).toBe(1);
  });

  it('does not crash on junk', () => {
    expect(compareVersions('', '1.0.0')).toBe(-1);
    expect(compareVersions('not-a-version', '1.0.0')).toBe(-1);
  });
});

describe('isValidVersion', () => {
  it('accepts real versions and rejects the rest', () => {
    expect(isValidVersion('1.0.0')).toBe(true);
    expect(isValidVersion('v2.10.3-beta.1')).toBe(true);
    // A malformed value parsed as 0.0.0 would read as "everything is newer"
    // and nag every user forever, so it has to be rejected outright.
    expect(isValidVersion('latest')).toBe(false);
    expect(isValidVersion('')).toBe(false);
    expect(isValidVersion(null)).toBe(false);
    expect(isValidVersion(42)).toBe(false);
  });
});

describe('isOlderThan', () => {
  it('is strict', () => {
    expect(isOlderThan('1.0.0', '1.0.1')).toBe(true);
    expect(isOlderThan('1.0.1', '1.0.1')).toBe(false);
    expect(isOlderThan('1.0.2', '1.0.1')).toBe(false);
  });
});

describe('decideUpdateState', () => {
  const info = (latest: string, minimum: string, updateRequired = false) => ({
    latestVersion: latest,
    minimumVersion: minimum,
    updateRequired,
  });

  it('says nothing when the installed build is current', () => {
    expect(decideUpdateState('1.4.0', info('1.4.0', '1.2.0'))).toBe('none');
  });

  it('says nothing when the installed build is ahead of the store', () => {
    // A TestFlight or internal build. Prompting someone to "update" to an older
    // version would be nonsense.
    expect(decideUpdateState('1.5.0', info('1.4.0', '1.2.0'))).toBe('none');
  });

  it('offers an optional update below the latest version', () => {
    expect(decideUpdateState('1.3.0', info('1.4.0', '1.2.0'))).toBe('optional');
  });

  it('forces an update below the minimum version', () => {
    expect(decideUpdateState('1.1.0', info('1.4.0', '1.2.0'))).toBe('mandatory');
  });

  it('treats the minimum version itself as acceptable', () => {
    expect(decideUpdateState('1.2.0', info('1.4.0', '1.2.0'))).toBe('optional');
  });

  it('honours updateRequired as a server override', () => {
    // Lets the backend force an update for a reason the numbers cannot express,
    // such as a specific build breaking an API contract.
    expect(decideUpdateState('1.4.0', info('1.4.0', '1.2.0', true))).toBe('mandatory');
  });

  it('uses the two-digit comparison, not string order', () => {
    expect(decideUpdateState('1.9.0', info('1.10.0', '1.2.0'))).toBe('optional');
    expect(decideUpdateState('1.10.0', info('1.10.0', '1.9.0'))).toBe('none');
  });
});
