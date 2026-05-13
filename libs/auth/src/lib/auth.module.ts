import { Module, module, onRunning, create } from '@svx/di'
import { SessionManager }                    from '@svx/security'
import { AuthService }                       from './auth.service'
import type { OIDCUser, OIDCTicket }         from '@svx/security'

@module({ name: 'auth' })
export class AuthModule extends Module {
  constructor(private readonly authService: AuthService) {
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
