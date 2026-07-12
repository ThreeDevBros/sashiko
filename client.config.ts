/**
 * client.config.ts — Per-client tenant configuration.
 *
 * This is the SINGLE FILE that changes when the template is forked for a new client.
 * The template code reads from here for all tenant-specific values (brand, bundle IDs,
 * domains, feature flags). Never hardcode a tenant value in template code — add a field
 * here and read `clientConfig.<field>` instead.
 *
 * See docs/TEMPLATE.md for the full "what to edit when forking" checklist.
 */

export type ClientConfig = {
  /** Stable slug used in overrides paths (src/overrides/<slug>/) and CI. Lowercase, no spaces. */
  slug: string;

  brand: {
    /** Display name shown in the UI, emails, and store listings. */
    name: string;
    /** Short marketing tagline (hero subtitle fallback). */
    tagline: string;
  };

  /** Native app identifiers. Must be unique per client across App Store + Play Store. */
  native: {
    /** Reverse-DNS bundle ID, e.g. "com.sashiko.app". */
    appId: string;
    /** Human app name shown on the home screen. */
    appName: string;
  };

  /** Public web presence. */
  web: {
    /** Production domain WITHOUT protocol, e.g. "sashikoasianfusion.com". */
    productionDomain: string;
    /** Support email surfaced in the app and legal pages. */
    supportEmail: string;
  };

  /**
   * Per-client feature flags. Template features check these before rendering.
   * Default every flag to `true` unless a client explicitly opts out — most clients
   * want the full stack; disabling is the exception.
   */
  features: {
    loyaltyCashback: boolean;
    tableReservations: boolean;
    delivery: boolean;
    multiBranch: boolean;
  };

  /**
   * Store submission context. All clients currently ship under our shared
   * Apple/Google developer accounts, so the operator panel is the source of
   * truth for signing certs — this block just records the intent.
   */
  storeSubmission: {
    /** "shared" = our accounts host the app. "client" = the client's own accounts. */
    ownership: 'shared' | 'client';
  };
};

export const clientConfig: ClientConfig = {
  slug: 'sashiko',
  brand: {
    name: 'Sashiko Asian Fusion',
    tagline: 'Experience the finest dining',
  },
  native: {
    appId: 'com.sashiko.app',
    appName: 'Sashiko Asian Fusion',
  },
  web: {
    productionDomain: 'sashikoasianfusion.com',
    supportEmail: 'support@sashikoasianfusion.com',
  },
  features: {
    loyaltyCashback: true,
    tableReservations: true,
    delivery: true,
    multiBranch: true,
  },
  storeSubmission: {
    ownership: 'shared',
  },
};

/** Convenience helper for feature flag checks in components. */
export const isFeatureEnabled = (feature: keyof ClientConfig['features']): boolean =>
  clientConfig.features[feature] === true;
