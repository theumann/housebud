// Matching (Matches, Shortlist, Compatibility, Chat) is on unless the build
// sets NEXT_PUBLIC_FEATURE_MATCHING=false, as production does until matching
// opens there. The backend's FEATURE_MATCHING removes its endpoints, and
// next.config.ts redirects its pages to /household.
export const matchingEnabled =
  process.env.NEXT_PUBLIC_FEATURE_MATCHING !== "false";
