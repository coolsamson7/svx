import { Session } from "./session.interface";

import { Ticket } from './ticket.interface';

export class AuthenticationException extends Error {
  // constructor

  constructor(user: string, reason: string) {
    super('failed authentication for ' + user + ', reason: ' + reason);
  }
}

/**
 * an authentication request consisting of - at least - the user and password
 */
export interface AuthenticationRequest {
  /**
   * the user name
   */
  user : string;
  /**
   * the password
   */
  password : string;

  /**
   * any other parameters
   */
  [prop : string] : any;
}

/**
 *  `Authentication` is responsible to establish and delete a user session.
 * @param R any information requires to trigger the login
 * @params U the user type
 * @params T the ticket type
 */
export interface Authentication<R = any, U = any, T extends Ticket = Ticket> {
  /**
   * setup the authentication and possibly restore a valid session.
   */
  start(): Promise<Session<U, T> | null>;

  /**
   * request a session
   * @param request any request information.
   * @returns a valid session
   */
  login(request: R): Promise<Session<U, T>>;

  /**
   * logout
   */
  logout(): Promise<void>;
}
