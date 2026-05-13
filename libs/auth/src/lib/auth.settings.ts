import { AbstractInstanceProvider, Providers } from '@svx/di'

export class AuthSettings {
  authority!:                  string
  client_id!:                  string
  redirect_uri!:               string
  scope!:                      string
  post_logout_redirect_uri?:   string
  rolesExtractor?:             (profile: Record<string, unknown>) => string[]
}

class AuthSettingsProvider extends AbstractInstanceProvider<AuthSettings> {
  constructor(private readonly settings: AuthSettings) { super() }

  override getType()  { return AuthSettings }
  override isEager()  { return true }
  override getScope() { return 'singleton' }
  override create()   { return this.settings }
}

export function configureAuth(settings: AuthSettings): void {
  Providers.register(new AuthSettingsProvider(settings))
}
