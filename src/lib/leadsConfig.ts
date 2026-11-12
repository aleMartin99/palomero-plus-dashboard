export type LeadReason =
  | 'at_limit'
  | 'churn_risk'
  | 'heavy_pro_feature'
  | 'has_for_sale'
  | 'recently_active';

export interface LeadsConfig {
  /** Free-tier pigeon limit; users at or above it are close to the paywall. */
  freePigeonLimit: number;
  /** A Pro subscription ending within this many days counts as churning. */
  churnWindowDays: number;
  /** Opens in 30 days of a Pro-leaning feature that count as heavy use. */
  heavyOpensThreshold: number;
  /** Feature keys (see the app's kFeatureKeys) that Pro users lean on. */
  proLeaningFeatures: readonly string[];
  points: Record<LeadReason, number>;
}

/** Starting guesses; tune these after looking at the first lists. */
export const LEADS_CONFIG: LeadsConfig = {
  freePigeonLimit: 3,
  churnWindowDays: 7,
  heavyOpensThreshold: 10,
  proLeaningFeatures: ['health_assistant', 'marketplace', 'genealogy', 'breeding_calendar'],
  points: {
    at_limit: 3,
    churn_risk: 3,
    heavy_pro_feature: 2,
    has_for_sale: 2,
    recently_active: 1,
  },
};
