import { JWTPayload }            from 'jose'
import { AsyncLocalStorage }     from 'async_hooks'
import { Session }               from './session.interface'
import { Ticket }                from './ticket.interface'
import { SessionContext, SessionContextBuilder, SessionFactory } from './session.context'
import { CachingSessionStore }   from './caching-session-store'
import { tokenStorage }          from './jwt-session-context'

// Direct-session ALS: used by message subscribers and other non-HTTP entry points
// that construct a Session themselves (e.g., from AMQP headers) and need it visible
// to SessionContextAspect without going through the JWT path.
export const sessionStorage = new AsyncLocalStorage<Session>()

/**
 * Server-side SessionContext backed by SessionContextBuilder.
 *
 * Accepts any SessionFactory<string, U> — JWT, API key, mTLS, or a test stub.
 * The factory is wired with tokenStorage (as SessionEnvironment) and a
 * CachingSessionStore via the standard builder.
 *
 * Two ways a session can be present:
 *  1. JWT path (HTTP): interceptor puts raw token into tokenStorage; establish()
 *     delegates to the factory, caches the Session keyed by token.
 *  2. Direct path (messaging): subscriber calls run(session, fn) which puts the
 *     Session into sessionStorage; current() returns it without any factory work.
 *
 * SessionContextAspect checks current() first and only calls establish() when
 * no session is found — so the direct path is always preferred.
 */
export class ServerSessionContext<U = JWTPayload, T extends Ticket = { token: string } & Ticket>
  implements SessionContext<U, T>
{
  private readonly inner: SessionContext<U, T>

  constructor(factory: SessionFactory<string, U, T>) {
    this.inner = new SessionContextBuilder<U, T, string>()
      .environment({ get: () => tokenStorage.getStore() ?? null })
      .factory(factory)
      .store(new CachingSessionStore())
      .build()
  }

  establish(): Promise<void> { return this.inner.establish() }

  current(): Session<U, T> | null {
    return (sessionStorage.getStore() as Session<U, T> | undefined)
      ?? this.inner.current()
  }

  /** For message subscribers: run fn with the given session active. */
  run<R>(session: Session<U, T>, fn: () => R): R {
    return sessionStorage.run(session as Session, fn) as R
  }
}
