/**
 * node-postgres currently treats sslmode=prefer|require|verify-ca as verify-full
 * (and warns that this will change to weaker libpq semantics in pg v9).
 * Pin today's behaviour explicitly: encrypt AND verify the server certificate.
 */
export function withVerifiedSsl(connectionString: string): string {
  if (!connectionString) return connectionString;
  const url = new URL(connectionString);
  const mode = url.searchParams.get("sslmode");
  if (mode === null || mode === "prefer" || mode === "require" || mode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }
  return url.toString();
}
