import { AsyncLocalStorage }                         from 'async_hooks'
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'
import { SessionContextBuilder, SessionFactory }     from './session.context'
import { CachingSessionStore }                       from './caching-session-store'
import { Session }                                   from './session.interface'
import { Ticket }                                    from './ticket.interface'

// Holds the raw JWT for the duration of the current request.
// Populated by SessionInterceptor (HTTP) before the handler runs.
export const tokenStorage = new AsyncLocalStorage<string>()

export interface JwtSessionConfig {
  jwksUri: string
}

/**
 * SessionFactory implementation that validates a raw JWT string via JWKS
 * and maps the resulting claims to a typed domain user.
 *
 * Stateless and reusable: construct once, pass to ServerSessionContext or
 * SessionContextBuilder. The JWKS client caches signing keys internally.
 */
export class JwtSessionFactory<U = JWTPayload, T extends Ticket & { token: string } = { token: string } & Ticket>
  implements SessionFactory<string, U, T>
{
  private readonly JWKS: ReturnType<typeof createRemoteJWKSet>

  constructor(
    config:   JwtSessionConfig,
    private readonly mapClaims: (payload: JWTPayload) => U = p => p as unknown as U,
  ) {
    this.JWKS = createRemoteJWKSet(new URL(config.jwksUri))
  }

  async create(token: string): Promise<Session<U, T>> {
    const { payload } = await jwtVerify(token, this.JWKS)
    return {
      user:   this.mapClaims(payload),
      ticket: { token } as T,
      expiry: payload.exp ? payload.exp * 1000 : undefined,
    }
  }
}

/**
 * Convenience builder: wires JwtSessionFactory + tokenStorage + CachingSessionStore
 * into a ready-to-use SessionContext. Use ServerSessionContext when you need a
 * NestJS-injectable class token or the direct-session (messaging) path.
 */
export function createJwtSessionContext<U = JWTPayload, T extends Ticket & { token: string } = { token: string } & Ticket>(
  config:     JwtSessionConfig,
  mapClaims?: (payload: JWTPayload) => U,
): ReturnType<SessionContextBuilder<U, T, string>['build']> {
  return new SessionContextBuilder<U, T, string>()
    .environment({ get: () => tokenStorage.getStore() ?? null })
    .factory(new JwtSessionFactory<U, T>(config, mapClaims))
    .store(new CachingSessionStore())
    .build()
}
