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
  | "supplier.opportunities.browse"
  | "supplier.opportunities.apply"
  // Profile page is the unified hub since the onboarding wizard moved there
  // as a "Settings" tab. profile.access admits any supplier with a row
  // (in_onboarding / pending_review / approved / rejected); the customize
  // and portfolio tabs gate themselves on `profile.customize` (approved).
  | "supplier.profile.access"
  | "supplier.profile.customize";

export type OrganizerFeature =
  | "organizer.dashboard"
  | "organizer.events"
  | "organizer.rfqs"
  | "organizer.bookings";

export type AdminFeature =
  | "admin.console"
  | "feedback.admin.read"
  | "feedback.admin.write";

// Cross-role features available to any signed-in user. Today this is just the
// in-app feedback widget; keep this union small so the matrix stays readable.
export type SharedFeature = "feedback.submit";

export type AccessFeature =
  | SupplierFeature
  | OrganizerFeature
  | AdminFeature
  | SharedFeature;

type FeatureSet = Partial<Record<AccessFeature, boolean>>;

type StateConfig = {
  bestDestination: string;
  allowedRoutePrefixes: string[];
  features: FeatureSet;
};

// Cross-role features any signed-in user gets, regardless of role/state.
// Spread into every authenticated state below so the in-app feedback pill
// is always one click away.
const SHARED_AUTH_FEATURES: FeatureSet = {
  "feedback.submit": true,
};

const SUPPLIER_APPROVED_FEATURES: FeatureSet = {
  ...SHARED_AUTH_FEATURES,
  "supplier.dashboard": true,
  "supplier.onboarding.wizard": true, // approved suppliers may edit business info
  "supplier.catalog": true,
  "supplier.calendar": true,
  "supplier.bookings": true,
  "supplier.rfqs.view": true,
  "supplier.rfqs.respond": true,
  // Marketplace is approved-only per the plan decision ("approved + published"
  // suppliers can browse + apply); the is_published check is enforced by RLS +
  // the browse loader.
  "supplier.opportunities.browse": true,
  "supplier.opportunities.apply": true,
  "supplier.profile.access": true,
  "supplier.profile.customize": true,
};

const ORGANIZER_FEATURES: FeatureSet = {
  ...SHARED_AUTH_FEATURES,
  "organizer.dashboard": true,
  "organizer.events": true,
  "organizer.rfqs": true,
  "organizer.bookings": true,
};

const ADMIN_FEATURES: FeatureSet = {
  "admin.console": true,
  "feedback.admin.read": true,
  "feedback.admin.write": true,
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
      ...SHARED_AUTH_FEATURES,
      "supplier.onboarding.path": true,
    },
  },
  "supplier.in_onboarding": {
    // Wizard now lives as the Settings tab on /supplier/profile.
    bestDestination: "/supplier/profile?tab=settings",
    allowedRoutePrefixes: [
      "/supplier/dashboard",
      "/supplier/onboarding",
      "/supplier/profile",
    ],
    features: {
      ...SHARED_AUTH_FEATURES,
      "supplier.dashboard": true,
      "supplier.onboarding.wizard": true,
      "supplier.profile.access": true,
    },
  },
  "supplier.pending_review": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: [
      "/supplier/dashboard",
      "/supplier/onboarding",
      "/supplier/profile",
    ],
    features: {
      ...SHARED_AUTH_FEATURES,
      "supplier.dashboard": true,
      "supplier.onboarding.wizard": true,
      "supplier.profile.access": true,
    },
  },
  "supplier.approved": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: ["/supplier"],
    features: SUPPLIER_APPROVED_FEATURES,
  },
  "supplier.rejected": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: [
      "/supplier/dashboard",
      "/supplier/onboarding",
      "/supplier/profile",
    ],
    features: {
      ...SHARED_AUTH_FEATURES,
      "supplier.dashboard": true,
      "supplier.onboarding.wizard": true,
      "supplier.profile.access": true,
    },
  },
  "supplier.suspended": {
    bestDestination: "/supplier/dashboard",
    allowedRoutePrefixes: ["/supplier/dashboard"],
    features: {
      ...SHARED_AUTH_FEATURES,
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
