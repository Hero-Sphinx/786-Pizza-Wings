// The one list of what anyone may reach without signing in. Shared by src/proxy.ts and the
// architecture tests: adding a public page or API route means adding it here, in review.

/** Pages that don't need a staff session. Everything under /admin except the login page is private. */
export const PUBLIC_PAGES = ["/", "/menu", "/about", "/privacy", "/checkout", "/order/[token]", "/admin/login"] as const;

/**
 * API routes that use withPublic() instead of withAuth(). Each one must rate-limit.
 * Paths are the route folders under src/app.
 */
export const PUBLIC_API_ROUTES = [
  "/api/health",
  "/api/quote",
  "/api/orders",
  "/api/orders/[token]",
  "/api/admin/login",
] as const;

export const ADMIN_LOGIN_PATH = "/admin/login";
export const SESSION_COOKIE = "pw_session";
