import { injectable }                                      from '@svx/di'
import { UserManager, type User }                          from 'oidc-client-ts'
import { Authentication, OIDCUser, OIDCTicket, Session }   from '@svx/security'
import { OIDCSettings }                                    from './oidc.settings'

const defaultRolesExtractor = (profile: Record<string, unknown>): string[] =>
  ((profile['realm_access'] as any)?.roles ?? []) as string[]

@injectable()
export class OIDCAuthService implements Authentication<void, OIDCUser, OIDCTicket> {
  private readonly userManager: UserManager

  constructor(private readonly settings: OIDCSettings) {
    this.userManager = new UserManager({
      authority:                settings.authority,
      client_id:                settings.client_id,
      redirect_uri:             settings.redirect_uri,
      scope:                    settings.scope,
      post_logout_redirect_uri: settings.post_logout_redirect_uri,
      response_mode:            'query',
      automaticSilentRenew:     true,
    })
  }

  async start(): Promise<Session<OIDCUser, OIDCTicket> | null> {
    const callbackPath = new URL(this.settings.redirect_uri).pathname
    let oidcUser: User | null

    if (window.location.pathname === callbackPath) {
      oidcUser = await this.userManager.signinRedirectCallback()
    } else {
      oidcUser = await this.userManager.getUser()
    }

    if (!oidcUser || oidcUser.expired) return null
    return this.buildSession(oidcUser)
  }

  async login(_request: void): Promise<Session<OIDCUser, OIDCTicket>> {
    await this.userManager.signinRedirect()
    throw new Error('OIDC redirect in progress')
  }

  async logout(): Promise<void> {
    return this.userManager.signoutRedirect()
  }

  async getToken(): Promise<string | undefined> {
    const user = await this.userManager.getUser()
    return user?.access_token ?? undefined
  }

  getUserManager(): UserManager {
    return this.userManager
  }

  private buildSession(user: User): Session<OIDCUser, OIDCTicket> {
    const extract = this.settings.rolesExtractor ?? defaultRolesExtractor
    const profile = user.profile as Record<string, unknown>

    // Keycloak puts realm_access in the access token but not the userinfo endpoint
    if (!profile['realm_access'] && user.access_token) {
      try {
        const payload = JSON.parse(atob(user.access_token.split('.')[1]))
        if (payload['realm_access']) profile['realm_access'] = payload['realm_access']
      } catch { /* malformed token — skip */ }
    }

    return {
      user: {
        sub:                user.profile.sub,
        name:               (user.profile.name               as string) ?? '',
        given_name:         (user.profile.given_name          as string) ?? '',
        family_name:        (user.profile.family_name         as string) ?? '',
        email:              (user.profile.email               as string) ?? '',
        email_verified:     (user.profile.email_verified      as unknown as string) ?? '',
        preferred_username: (user.profile.preferred_username  as string) ?? '',
        roles:              extract(profile),
      },
      ticket: {
        accessToken:  user.access_token,
        refreshToken: user.refresh_token,
        idToken:      user.id_token,
      },
      expiry:        user.expires_at ? user.expires_at * 1000 : undefined,
      sessionLocals: {},
    }
  }
}
