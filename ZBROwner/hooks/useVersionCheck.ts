import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAppVersion } from '../services/api';
import { APP_VERSION } from '../constants/appVersion';
import { compareVersions, isOlderThan, isValidVersion } from '../utils/semver';
import type { AppVersionInfo } from '../types';

/** Nothing to show / offer an update / force one. */
export type UpdateState = 'none' | 'optional' | 'mandatory';

export interface VersionCheck {
  state: UpdateState;
  /** Store URL from the server, already validated against the platform. */
  storeUrl?: string;
  latestVersion?: string;
  /** Dismiss the optional prompt for this version. Mandatory cannot be dismissed. */
  dismiss: () => void;
}

/** Remembers the last version whose optional prompt the user waved away. */
const DISMISSED_KEY = 'zbr_update_dismissed_version';
/** Remembers when we last asked the server, so resuming does not re-ask. */
const LAST_CHECK_KEY = 'zbr_update_last_check';

/**
 * How long to wait between checks.
 *
 * A vendor backgrounds and resumes this app dozens of times a shift. Checking
 * on every resume would be a request per resume for information that changes a
 * few times a year, and it risks re-showing a prompt the user just dismissed.
 */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Unwrap either the bare object or the project's { data } envelope. */
function readInfo(response: unknown): AppVersionInfo | null {
  if (!response || typeof response !== 'object') return null;
  const maybeEnvelope = response as { data?: unknown };
  const candidate = (maybeEnvelope.data ?? response) as Partial<AppVersionInfo>;
  if (!isValidVersion(candidate.latestVersion)) return null;
  return {
    latestVersion: candidate.latestVersion,
    minimumVersion: isValidVersion(candidate.minimumVersion)
      ? candidate.minimumVersion
      : '0.0.0',
    updateRequired: candidate.updateRequired === true,
    storeUrl: typeof candidate.storeUrl === 'string' ? candidate.storeUrl : undefined,
  };
}

/**
 * Decide what to show. Pure, so the rules are testable without a device.
 *
 * `updateRequired` from the server is honoured as an override — it lets the
 * backend force an update for a reason the version numbers do not express, such
 * as a broken API contract in a specific build.
 */
export function decideUpdateState(installed: string, info: AppVersionInfo): UpdateState {
  if (isOlderThan(installed, info.minimumVersion) || info.updateRequired) return 'mandatory';
  if (isOlderThan(installed, info.latestVersion)) return 'optional';
  return 'none';
}

/**
 * Check for a newer app version on launch and on resume.
 *
 * Silent on every failure: no network, an endpoint that does not exist yet, a
 * malformed payload. An update prompt is a convenience, and a vendor in the
 * middle of service must never see an error about one.
 */
export function useVersionCheck(): VersionCheck {
  const [state, setState] = useState<UpdateState>('none');
  const [info, setInfo] = useState<AppVersionInfo | null>(null);
  const checking = useRef(false);

  const check = useCallback(async (force = false) => {
    if (checking.current) return;
    checking.current = true;

    try {
      if (!force) {
        const last = Number(await AsyncStorage.getItem(LAST_CHECK_KEY));
        if (Number.isFinite(last) && Date.now() - last < CHECK_INTERVAL_MS) return;
      }

      const parsed = readInfo(await fetchAppVersion());
      if (!parsed) return;

      await AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()));

      const next = decideUpdateState(APP_VERSION, parsed);

      // A dismissal applies to one version only: dismissing 1.4.0 must not
      // suppress the prompt for 1.5.0. Mandatory updates ignore it entirely.
      if (next === 'optional') {
        const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
        if (dismissed && compareVersions(dismissed, parsed.latestVersion) >= 0) {
          setState('none');
          return;
        }
      }

      setInfo(parsed);
      setState(next);
    } catch {
      // Never surface a version-check failure to a vendor.
    } finally {
      checking.current = false;
    }
  }, []);

  useEffect(() => {
    check();

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });
    return () => sub.remove();
  }, [check]);

  const dismiss = useCallback(() => {
    setState('none');
    if (info?.latestVersion) {
      AsyncStorage.setItem(DISMISSED_KEY, info.latestVersion).catch(() => {});
    }
  }, [info]);

  return {
    state,
    storeUrl: info?.storeUrl,
    latestVersion: info?.latestVersion,
    dismiss,
  };
}
