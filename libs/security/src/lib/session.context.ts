import { Injectable } from '@nestjs/common';
import { Session } from './session.interface';
import { Ticket } from './ticket.interface';

/**
 * SessionContext provides access to the session
 * bound to the current execution context (request, async flow, UI scope).
 *
 * It MUST NOT store session state itself.
 */
@Injectable()
export abstract class SessionContext<U = any, T extends Ticket = Ticket> {
  abstract establish(): Promise<void>;
  abstract current(): Session<U, T> | null;
}

export class SessionContextBuilder<U = any, T extends Ticket = Ticket, S = string> {
  private _environment?:   SessionEnvironment<S>
  private _factory?:       SessionFactory<S, U, T>
  private _store?:         SessionStore<S, U, T>
  private _directSession?: () => Session<U, T> | null

  environment(env: SessionEnvironment<S>): this {
    this._environment = env
    return this
  }

  factory(factory: SessionFactory<S, U, T>): this {
    this._factory = factory
    return this
  }

  store(store: SessionStore<S, U, T>): this {
    this._store = store
    return this
  }

  directSession(resolver: () => Session<U, T> | null): this {
    this._directSession = resolver
    return this
  }

  build(): SessionContext<U, T> {
    const env           = this._environment
    const factory       = this._factory
    const store         = this._store
    const directSession = this._directSession

    if (!env)     throw new Error('SessionContextBuilder: environment is required')
    if (!factory) throw new Error('SessionContextBuilder: factory is required')

    return new class extends SessionContext<U, T> {
      async establish(): Promise<void> {
        if (directSession?.()) return

        const source = env.get()
        if (source == null) return
        if (store?.get(source)) return

        const session = await factory.create(source)
        if (session && store) store.put(source, session)
      }

      current(): Session<U, T> | null {
        return directSession?.() ?? (() => {
          const source = env.get()
          if (source == null) return null
          return store?.get(source) ?? null
        })()
      }
    }
  }
}

/**
 * SessionEnvironment extracts authentication input
 * (credentials, tokens, cookies, OIDC state, etc.)
 * from the current environment.
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
  create(source: S): Session<U, T> | Promise<Session<U, T>>;
}

/**
 * SessionStore provides optional caching/persistence for sessions.
 *
 * It is independent from transport or execution context.
 * Typically backed by memory, Redis, or database.
 */
export interface SessionStore<K = string, U = any, T extends Ticket = Ticket> {
  get(key: K): Session<U, T> | null;
  put(key: K, session: Session<U, T>): void;
  remove(key: K): void;
}
