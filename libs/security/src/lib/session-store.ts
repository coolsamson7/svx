import { Session } from './session.interface';
import { Ticket } from './ticket.interface';

/**
 * SessionStore provides optional caching/persistence for sessions.
 *
 * It is independent of transport or execution context.
 * Typically backed by memory, Redis, or database.
 */
export interface SessionStore<K = string, U = any, T extends Ticket = Ticket> {
  get(key: K): Session<U, T> | null;
  put(key: K, session: Session<U, T>): void;
  remove(key: K): void;
}
