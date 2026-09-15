import * as fs from 'fs';
import * as path from 'path';

/**
 * Guards two bugs that shipped to a user and are invisible in normal testing:
 * a raw translation key rendered on screen, and an app-icon badge that never
 * cleared because nothing called setBadgeCountAsync.
 */

describe('locale parity', () => {
  const LOCALES = ['en', 'ru', 'uz-Latn', 'uz-Cyrl'];

  /** Every leaf path in a nested translation object, e.g. "more.logOut". */
  function leafPaths(obj: unknown, prefix = ''): string[] {
    if (typeof obj !== 'object' || obj === null) return [];
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
      const p = prefix ? `${prefix}.${k}` : k;
      return typeof v === 'object' && v !== null ? leafPaths(v, p) : [p];
    });
  }

  function load(locale: string): Record<string, unknown> {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'i18n', `${locale}.ts`), 'utf8');
    const body = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    // eslint-disable-next-line no-eval
    return eval(`(${body})`);
  }

  const dicts = Object.fromEntries(LOCALES.map((l) => [l, load(l)]));
  const english = leafPaths(dicts.en).sort();

  it.each(LOCALES.filter((l) => l !== 'en'))(
    '%s defines exactly the same keys as en',
    (locale) => {
      const theirs = leafPaths(dicts[locale]).sort();
      // A key present in en but missing here renders as the raw dotted path,
      // which is what a user reported seeing on the notifications screen.
      expect(theirs.filter((k) => !english.includes(k))).toEqual([]);
      expect(english.filter((k) => !theirs.includes(k))).toEqual([]);
    },
  );

  it('every key referenced in app code exists in en', () => {
    const files: string[] = [];
    (function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry.name) && !p.includes(`${path.sep}i18n${path.sep}`)) {
          files.push(p);
        }
      }
    })(path.join(__dirname, '..'));

    const referenced = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)'/g)) {
        // noUncheckedIndexedAccess: the capture group is typed as possibly
        // undefined even though a match guarantees it.
        if (m[1]) referenced.add(m[1]);
      }
    }

    const known = new Set(english);
    expect([...referenced].filter((k) => !known.has(k))).toEqual([]);
  });
});

describe('app icon badge', () => {
  it('follows the unread count', () => {
    jest.resetModules();
    const setAppBadgeCount = jest.fn();

    jest.doMock('../utils/notifications', () => ({ setAppBadgeCount }));
    jest.doMock('../services/api', () => ({}));
    jest.doMock('../store/authStore', () => ({
      useAuthStore: { getState: () => ({ restaurant: null }), subscribe: () => () => {} },
    }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useStore } = require('../store');

    useStore.getState().setUnreadNotifCount(4);
    expect(setAppBadgeCount).toHaveBeenLastCalledWith(4);

    // The reported bug: reading everything left the icon badge showing a count.
    useStore.getState().setUnreadNotifCount(0);
    expect(setAppBadgeCount).toHaveBeenLastCalledWith(0);
  });
});
