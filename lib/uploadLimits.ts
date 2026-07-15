/**
 * Real ceiling for any base64-JSON-body upload on Vercel, discovered by
 * testing directly against production: Vercel's serverless function
 * gateway hard-rejects request bodies over ~4.5MB with a 413 BEFORE the
 * request ever reaches our code (no auth check, no friendly error — just
 * a raw "FUNCTION_PAYLOAD_TOO_LARGE" text response). Base64 adds ~33%
 * overhead, so a raw file has to stay well under 4.5MB / 1.33 ≈ 3.4MB to
 * survive the trip as JSON. 3MB leaves headroom for the surrounding JSON
 * fields (title, recipients, etc.) on routes that send more than just the file.
 *
 * A previously-documented "8MB" limit on the files route was never
 * actually reachable — anything past ~3.3MB raw failed with a confusing
 * platform-level error instead of ever hitting the code's own check.
 */
export const MAX_DIRECT_UPLOAD_BYTES = 3 * 1024 * 1024
export const MAX_DIRECT_UPLOAD_LABEL = '3MB'
