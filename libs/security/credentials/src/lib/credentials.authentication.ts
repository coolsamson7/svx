import { Authentication, Session, Ticket } from '@svx/security';

export interface UsernamePasswordRequest {
  username: string;
  password: string;
}

export type CredentialsValidator<U, T extends Ticket> =
  (username: string, password: string) => Promise<Session<U, T>>;

/**
 * Username/password authentication that delegates credential validation to a
 * caller-supplied function and persists the session in sessionStorage.
 */
export class UsernamePasswordAuthentication<U = any, T extends Ticket = Ticket>
  implements Authentication<UsernamePasswordRequest, U, T> {

  private static readonly SESSION_KEY = 'svx:credentials:session';

  constructor(private readonly validate: CredentialsValidator<U, T>) {}

  async login(request: UsernamePasswordRequest): Promise<Session<U, T>> {
    const session = await this.validate(request.username, request.password);
    sessionStorage.setItem(
      UsernamePasswordAuthentication.SESSION_KEY,
      JSON.stringify(session),
    );
    return session;
  }

  async start(): Promise<Session<U, T> | null> {
    const stored = sessionStorage.getItem(UsernamePasswordAuthentication.SESSION_KEY);
    if (!stored) return null;

    try {
      const session = JSON.parse(stored) as Session<U, T>;
      if (session.expiry && Date.now() > session.expiry) {
        sessionStorage.removeItem(UsernamePasswordAuthentication.SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async logout(): Promise<void> {
    sessionStorage.removeItem(UsernamePasswordAuthentication.SESSION_KEY);
  }
}
