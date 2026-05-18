import { Module, module, onRunning, create } from '@svx/di'
import { SessionManager }                    from '@svx/security'
import { OIDCAuthService }                   from './oidc.service'
import type { OIDCUser, OIDCTicket }         from '@svx/security'

@module({ name: 'security-oidc' })
export class OIDCModule extends Module {
  constructor(private readonly authService: OIDCAuthService) {
    super()
  }

  @create()
  createSessionManager(): SessionManager<void, OIDCUser, OIDCTicket> {
    return new SessionManager(this.authService)
  }

  @onRunning()
  async init(sessionManager: SessionManager<void, OIDCUser, OIDCTicket>): Promise<void> {
    await sessionManager.start()
  }
}
