import { Observable, throwError } from 'rxjs';

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
 * this interface covers the main authentication method.
 */
export class Authentication<U = any, T extends Ticket = Ticket> {
    /**
     * return a combination of a user and ticket related to the specified authentication request.
     * @param request the authentication request
     */
    authenticate(request : AuthenticationRequest) : Observable<Session<U, T>> {
        return throwError(new AuthenticationException(request.user, 'no authentication configured'));
    }
}
