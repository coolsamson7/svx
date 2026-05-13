import { OIDCUser } from './oidc-user';
import { SessionManager } from '../session-manager';

export interface OIDCTicket {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
}

export type OIDCSessionManager = SessionManager<OIDCUser, OIDCTicket>;
