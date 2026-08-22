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
  privacyPolicyUrl: null as string | null,
  /** Terms of service. Null hides the row. */
  termsUrl: null as string | null,
  /** Open-source licenses page. Null hides the row. */
  licensesUrl: null as string | null,
  /** Where vendors request account/data deletion. Declared in Play Console. */
  dataDeletionUrl: null as string | null,

  /** Support phone in E.164, e.g. '+998712000000'. Null hides the card. */
  supportPhone: null as string | null,
  /** Monitored support inbox — use the same address as the Play listing. */
  supportEmail: null as string | null,
  /** Live chat URL. Null hides the card (there is no chat surface today). */
  liveChatUrl: null as string | null,
} as const;

/** True when at least one legal link is configured. */
export const hasLegalLinks = Boolean(
  CONTACT.privacyPolicyUrl || CONTACT.termsUrl || CONTACT.licensesUrl || CONTACT.dataDeletionUrl,
);

/** True when at least one support channel is configured. */
export const hasSupportChannels = Boolean(
  CONTACT.supportPhone || CONTACT.supportEmail || CONTACT.liveChatUrl,
);
