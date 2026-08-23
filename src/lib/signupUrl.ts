// Signup-sidan ligger på app-subdomänen och är alltså ett eget origin. Valet av
// upplägg kan därför inte skickas vidare via sessionStorage — det följer med i
// URL:en som ?plan=, och plockas upp av signup-sidan på andra sidan.
export type BillingPeriod = 'monthly' | 'yearly';

const SIGNUP_URL = 'https://app.enklabokslut.se/auth/signup';

/** Tolkar en ?plan=-parameter. Allt annat än de två giltiga värdena blir null. */
export function parsePlan(value: string | null | undefined): BillingPeriod | null {
  return value === 'monthly' || value === 'yearly' ? value : null;
}

export function signupUrl(plan?: BillingPeriod | null): string {
  return plan ? `${SIGNUP_URL}?plan=${plan}` : SIGNUP_URL;
}
