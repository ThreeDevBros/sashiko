/**
 * Canonical public site URL.
 *
 * Every link we hand to the backend (auth email redirects, OAuth returns)
 * must point at the restaurant's own domain — never at a build/preview host.
 * Using `window.location.origin` would leak whichever host the user happened
 * to be on into verification emails.
 */
export const SITE_URL = "https://sashikoasianfusion.com";

/** Build an absolute URL on the canonical site. */
export const siteUrl = (path = "/"): string =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * Where auth emails should land after the user taps the action button.
 * `src` lets /auth/confirmed offer a deep link back into the native app.
 */
export const authRedirectUrl = (
  path: string,
  src: "app" | "web",
): string => `${siteUrl(path)}?src=${src}`;
