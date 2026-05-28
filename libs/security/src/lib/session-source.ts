/**
 * SessionSource extracts authentication input
 * (credentials, tokens, cookies, OIDC state, etc.)
 * from the current environment.
 */
export interface SessionSource<S = any> {
  get(): S | null
}
