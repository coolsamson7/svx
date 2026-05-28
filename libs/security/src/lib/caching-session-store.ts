import { Session } from './session.interface'
import { Ticket } from './ticket.interface'
import { SessionStore } from './session-store';

interface Entry<U, T extends Ticket> {
  session: Session<U, T>
  expiresAt: number | undefined
}

export class CachingSessionStore<K = string, U = any, T extends Ticket = Ticket> implements SessionStore<K, U, T> {
  private readonly entries = new Map<K, Entry<U, T>>()

  get(key: K): Session<U, T> | null {
    const entry = this.entries.get(key)
    if (!entry) return null

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return null
    }

    return entry.session
  }

  put(key: K, session: Session<U, T>): void {
    this.entries.set(key, { session, expiresAt: session.expiry })
  }

  remove(key: K): void {
    this.entries.delete(key)
  }
}
