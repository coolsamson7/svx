import { AbstractInstanceProvider, Providers } from '@svx/di'

export class OIDCSettings {
  authority!:                  string
  client_id!:                  string
  redirect_uri!:               string
  scope!:                      string
  post_logout_redirect_uri?:   string
  rolesExtractor?:             (profile: Record<string, unknown>) => string[]
}

class OIDCSettingsProvider extends AbstractInstanceProvider<OIDCSettings> {
  constructor(private readonly settings: OIDCSettings) { super() }

  override getType()  { return OIDCSettings }
  override isEager()  { return true }
  override getScope() { return 'singleton' }
  override create()   { return this.settings }
}

export function configureOIDC(settings: OIDCSettings): void {
  Providers.register(new OIDCSettingsProvider(settings))
}
