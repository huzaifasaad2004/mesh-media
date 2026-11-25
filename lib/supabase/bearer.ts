/** The Supabase access token from an `Authorization: Bearer <jwt>` header, or null.
 *
 *  The mobile app has no cookies — it sends its session token this way instead.
 *  Only JWT-shaped values count: other bearer secrets that reach the API
 *  (CRON_SECRET, CELINE_API_TOKEN) are opaque strings and must keep falling
 *  through to their own checks rather than being handed to Supabase as a user.
 *
 *  Shape is all this checks. The token is only trusted once Supabase verifies
 *  it (`auth.getUser(token)`) — middleware and `requireUser()` both do. */
export function bearerToken(authorization: string | null | undefined): string | null {
  const match = /^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(authorization?.trim() ?? '')
  return match ? match[1] : null
}
