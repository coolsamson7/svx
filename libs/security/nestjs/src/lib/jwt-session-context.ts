import { AsyncLocalStorage }                         from 'async_hooks'
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'

import { Session, Ticket, SessionFactory }         from '@svx/security'

// Holds the raw JWT for the duration of the current request.
// Populated by SessionInterceptor (HTTP) before the handler runs.
export const tokenStorage = new AsyncLocalStorage<string>()

// Holds a pre-built Session for non-HTTP entry points (e.g. message subscribers).
export const sessionStorage = new AsyncLocalStorage<Session>()

export function runWithSession<R>(session: Session, fn: () => R): R {
  return sessionStorage.run(session, fn) as R
}

export interface JwtSessionConfig {
  jwksUri: string
}

/**
 * SessionFactory implementation that validates a raw JWT string via JWKS
 * and maps the resulting claims to a typed domain user.
 *
 * Stateless and reusable: construct once, pass to SessionContextBuilder.
 * The JWKS client caches signing keys internally.
 */
export class JwtSessionFactory<U = JWTPayload, T extends Ticket & { token: string } = { token: string } & Ticket>
  implements SessionFactory<string, U, T>
{
  private JWKS: ReturnType<typeof createRemoteJWKSet> | undefined

  constructor(
    private readonly config: JwtSessionConfig,
    private readonly mapClaims: (payload: JWTPayload) => U = p => p as unknown as U,
  ) {}

  async create(token: string): Promise<Session<U, T>> {
    if (!this.JWKS) this.JWKS = createRemoteJWKSet(new URL(this.config.jwksUri))
    const { payload } = await jwtVerify(token, this.JWKS)
    return {
      user:   this.mapClaims(payload),
      ticket: { token } as T,
      expiry: payload.exp ? payload.exp * 1000 : undefined,
    }
  }
}
