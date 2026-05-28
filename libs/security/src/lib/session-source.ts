/**
 * SessionEnvironment extracts authentication input
 * (credentials, tokens, cookies, OIDC state, etc.)
 * from the current environment.
 */
export interface SessionEnvironment<S = any> {
  get(): S | null
}
