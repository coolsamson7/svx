import { Session } from './session.interface';
import { Ticket } from './ticket.interface';


/**
 * SessionContext provides access to the session
 * bound to the current execution context (request, async flow, UI scope).
 *
 * It MUST NOT store session state itself.
 */
export interface SessionContext<U = any, T extends Ticket = Ticket> {
  /**
   * Resolves the session from the current environment and caches it in the store.
   * Must be called once per request (e.g. from a NestJS interceptor) before current().
   */
  establish(): Promise<void>;

  /**
   * Returns the cached session for the current execution context, or null.
   * Synchronous — relies on establish() having been called first.
   */
  current(): Session<U, T> | null;
}

export class SessionContextBuilder<U = any, T extends Ticket = Ticket, S = any> {
  private _environment?: SessionEnvironment<S>
  private _factory?:     SessionFactory<S, U, T>
  private _store?:       SessionStore<U, T>

  environment(env: SessionEnvironment<S>): this {
    this._environment = env
    return this
  }

  factory(factory: SessionFactory<S, U, T>): this {
    this._factory = factory
    return this
  }

  store(store: SessionStore<U, T>): this {
    this._store = store
    return this
  }

  build(): SessionContext<U, T> {
    const env     = this._environment
    const factory = this._factory
    const store   = this._store

    if (!env)     throw new Error('SessionContextBuilder: environment is required')
    if (!factory) throw new Error('SessionContextBuilder: factory is required')

    return {
      async establish(): Promise<void> {
        const source = env.get()
        if (source == null) return

        const key = String(source)
        if (store?.get(key)) return

        const session = await factory.create(source)
        if (session && store) store.put(key, session)
      },

      current(): Session<U, T> | null {
        const source = env.get()
        if (source == null) return null

        return store?.get(String(source)) ?? null
      }
    }
  }
}

/**
 * SessionEnvironment extracts authentication input
 * (credentials, tokens, cookies, OIDC state, etc.)
 * from the current environment.
 *
 * It is environment-specific (browser, server, CLI, etc.).
 */
export interface SessionEnvironment<S = any> {
  get(): S | null
}

/**
 * SessionFactory creates a Session from authentication input.
 *
 * It contains domain logic such as:
 * - JWT parsing
 * - OIDC mapping
 * - role extraction
 * - claim normalization
 */
export interface SessionFactory<S = any, U = any, T extends Ticket = Ticket> {
  /**
   * Creates a session from a resolved authentication source.
   */
  create(source: S): Session<U, T> | Promise<Session<U, T>>;
}

/**
 * SessionStore provides optional caching/persistence for sessions.
 *
 * It is independent from transport or execution context.
 * Typically backed by memory, Redis, or database.
 */
export interface SessionStore<U = any, T extends Ticket = Ticket> {
  get(key: string): Session<U, T> | null;
  put(key: string, session: Session<U, T>): void;
  remove(key: string): void;
}
