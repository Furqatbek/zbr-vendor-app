import * as Application from 'expo-application';

/**
 * The version of the binary that is actually running.
 *
 * Read from the native bundle rather than app.json, because app.json is the
 * source for the *next* build — the two disagree for anyone running an older
 * install, and the version string exists precisely to tell you what you have.
 *
 * These were hardcoded in four locale files and one screen subtitle, which is
 * why the About screen said "Version 1.0.0 (Build 1)" while build 9 was in
 * review. A version string nobody remembers to update is worse than none.
 */
export const APP_VERSION = Application.nativeApplicationVersion ?? '—';
export const APP_BUILD = Application.nativeBuildVersion ?? '—';
