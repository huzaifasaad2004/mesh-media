import Stripe from 'stripe'

let cached: Stripe | null = null

/** Throws a friendly error if STRIPE_SECRET_KEY isn't set yet — never crash the whole request. */
export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Online payments aren\'t configured yet — add STRIPE_SECRET_KEY to the environment.')
  cached = new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
  return cached
}
