/**
 * Access-control matrix: maps `AccessState` → feature flags, `bestDestination`,
 * and `allowedRoutePrefixes`. Kept in one pure-data file so both middleware
 * and server components/actions share the same source of truth.
 *
 * Changing this file changes the authorization contract for the entire app —
 * the companion tests (`./__tests__/featureMatrix.test.ts`) pin the
 * expectations so a silent regression fails CI.
 */

export type AccessState =
  | "unauthenticated"
  | "forbidden"
  | "organizer.active"
  | "agency.active"
  | "admin.active"
  | "supplier.no_row"
  | "supplier.in_onboarding"
  | "supplier.pending_review"
  | "supplier.approved"
  | "supplier.rejected"
  | "supplier.suspended";

export type SupplierFeature =
  | "supplier.dashboard"
  | "supplier.onboarding.path"
  | "supplier.onboarding.wizard"
  | "supplier.catalog"
  | "supplier.calendar"
  | "supplier.bookings"
  | "supplier.rfqs.view"
  | "supplier.rfqs.respond"
  | "supplier.profile.customize";

export type OrganizerFeature =
  | "organizer.dashboard"
  | "organizer.events"
  | "organizer.rfqs"
  | "organizer.bookings";

export type AdminFeature = "admin.console";

export type AccessFeature = SupplierFeature | OrganizerFeature | AdminFeature;

type FeatureSet = Partial<Record<AccessFeature, boolean>>;

type StateConfig = {
  bestDestination: string;
  allowedRoutePrefixes: string[];
  features: FeatureSet;
};

const SUPPLIER_APPROVED_FEATURES: FeatureSet = {
  "supplier.dashboard": true,
  "supplier.onboarding.wizard": true, // approved suppliers may edit business info
  "supplier.catalog": true,
  "supplier.calendar": true,
  "supplier.bookings": true,
  "supplier.rfqs.view": true,
  "supplier.rfqs.respond": true,
  "supplier.profile.customize": true,
};

const ORGANIZER_FEATURES: FeatureSet = {
  "organizer.dashboard": true,
  "organizer.events": true,
  "organizer.rfqs": true,
  "organizer.bookings": true,
};

const ADMIN_FEATURES: FeatureSet = {
  "admin.console": true,
  ...SUPPLIER_APPROVED_FEATURES,
  ...ORGANIZER_FEATURES,
};

export const STATE_CONFIG: Record<AccessState, StateConfig> = {
  unauthenticated: {
    bestDestination: "/sign-in",
    allowedRoutePrefixes: [],
    features: {},
  },
  forbidden: {
    bestDestination: "/",
    allowedRoutePrefixes: [],
    features: {},
  },
  "organizer.active": {
    bestDestination: "/organizer/dashboard",
    allowedRoutePrefixes: ["/organizer"],
    features: ORGANIZER_FEATURES,
  },
  "agency.active": {
    // Agencies act on organizers' behalf and get the same surface today.
    bestDestination: "/organizer/dashboard",
    allowedRoutePrefixes: ["/organizer"],
    features: ORGANIZER_FEATURES,
  },
  "admin.active": {
    bestDestination: "/admin/dashboard",
    allowedRoutePrefixes: ["/admin", "/supplier", "/organizer"],
    features: ADMIN_FEATURES,
  },
  "supplier.no_row": {
    bestDestination: "/supplier/onboarding/path",
    // Limit to onboarding so a direct /supplier/dashboard hit bounces to the
    // path picker instead of rendering a broken dashboard.
    allowedRoutePrefixes: ["/supplier/onboarding"],
    features: {
      "supplier.onboarding.path": true,
    },
  },
  "supplier.in_onboarding": {
    bestDestination: "/supplier/onboarding",
    allowedRoutePrefixes: ["/supplier/dashboard", "/supplier/onboarding"],
    features: {
      "supplier.dashboard": true,
      "supplier.onboarding.wizard": true,
    },
  },
  "supplier.pending_review": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: ["/supplier/dashboard", "/supplier/onboarding"],
    features: {
      "supplier.dashboard": true,
      "supplier.onboarding.wizard": true,
    },
  },
  "supplier.approved": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: ["/supplier"],
    features: SUPPLIER_APPROVED_FEATURES,
  },
  "supplier.rejected": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: ["/supplier/dashboard", "/supplier/onboarding"],
    features: {
      "supplier.dashboard": true,
      "supplier.onboarding.wizard": true,
    },
  },
  "supplier.suspended": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: ["/supplier/dashboard"],
    features: {
      "supplier.dashboard": true,
    },
  },
};

export function isRouteAllowed(
  pathname: string,
  allowedPrefixes: readonly string[],
): boolean {
  for (const prefix of allowedPrefixes) {
    if (pathname === prefix) return true;
    if (pathname.startsWith(`${prefix}/`)) return true;
  }
  return false;
}
