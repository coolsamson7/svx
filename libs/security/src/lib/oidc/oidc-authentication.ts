
import { OIDCUser } from "./oidc-user";

import { Authentication, AuthenticationRequest } from '../authentication';
import { OIDCTicket } from "./oidc-session-manager";
import { Session } from "../session.interface";

export abstract class OIDCAuthentication
  implements Authentication<any, OIDCUser, OIDCTicket>
{
  abstract login(request: any): Promise<Session<OIDCUser, OIDCTicket>>;

  abstract logout(): Promise<void>;

  abstract start(): Promise<Session<OIDCUser, OIDCTicket> | null>;
  // implement Authentication
}
