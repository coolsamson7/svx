import { Session } from './session.interface';
import { Ticket } from './ticket.interface';

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
