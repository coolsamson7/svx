import { throwError } from "rxjs";
import { OIDCUser } from "./oidc-user";

import { Authentication, AuthenticationRequest } from '../authentication';
import { OIDCTicket } from "./oidc-session-manager";
import { injectable } from '@svx/di';

@injectable()
export class OIDCAuthentication implements Authentication<OIDCUser, OIDCTicket> {
    // implement Authentication

    authenticate(request : AuthenticationRequest) {
        return throwError(new Error('authentication failed'));
    }
}
