import { Session }        from './session.interface'
import { Ticket }         from './ticket.interface'
import { SessionContext } from './session.context'
import { SessionManager } from './session-manager'

export class BrowserSessionContext<U = any, T extends Ticket = Ticket>
  implements SessionContext<U, T>
{
  constructor(private readonly manager: SessionManager<any, U, T>) {}

  establish(): Promise<void> {
    return Promise.resolve()
  }

  current(): Session<U, T> | null {
    return this.manager.hasSession() ? this.manager.currentSession() : null
  }
}
