/**
 * Legal and support destinations.
 *
 * Anything left `null` is HIDDEN in the UI rather than rendered as a tappable
 * control that does nothing. The About and Help screens previously shipped
 * seven dead buttons — including a "Call Us" card advertising the US vanity
 * number 1-800-ZBR-HELP in an Uzbekistan vendor app, and an unverified
 * support@zbr.com — all of which animated on press and did nothing.
 *
 * ⚠️ PRIVACY_POLICY_URL is REQUIRED before Google Play submission: the store
 * listing has a mandatory privacy-policy field and Google fetches the URL to
 * confirm it resolves without a login. Publish docs/PRIVACY_POLICY.md first.
 *
 * Fill these in, then `npm run check:release` will stop warning about them.
 */

export const CONTACT = {
  /** Public, no-login URL of the hosted privacy policy. Required by Play. */
  privacyPolicyUrl: 'https://app.zbrr.uz/privacy' as string | null,
  /** Terms of service. Null hides the row. */
  termsUrl: null as string | null,
  /** Open-source licenses page. Null hides the row. */
  licensesUrl: null as string | null,
  /**
   * Optional web page for account/data deletion requests, declared in Play
   * Console → Data safety. Deletion itself is in-app
   * (`app/settings/delete-account.tsx`) because Apple 5.1.1(v) does not accept
   * a link out; this is only a convenience mirror for the Play listing and is
   * not rendered anywhere in the app.
   */
  dataDeletionUrl: null as string | null,

  /** Support phone in E.164, e.g. '+998712000000'. Null hides the card. */
  supportPhone: null as string | null,
  /** Monitored support inbox — use the same address as the Play listing. */
  supportEmail: null as string | null,
  /** Live chat URL. Null hides the card (there is no chat surface today). */
  liveChatUrl: null as string | null,
} as const;

/**
 * True when at least one legal link is configured — i.e. the Legal card in
 * About would render at least one row. `dataDeletionUrl` is deliberately not
 * counted: it has no row (deletion is in-app), so counting it would render an
 * empty card.
 */
export const hasLegalLinks = Boolean(
  CONTACT.privacyPolicyUrl || CONTACT.termsUrl || CONTACT.licensesUrl,
);

/** True when at least one support channel is configured. */
export const hasSupportChannels = Boolean(
  CONTACT.supportPhone || CONTACT.supportEmail || CONTACT.liveChatUrl,
);
