import type { SessionManager } from '@svx/security'

export interface AuthState {
  authenticated: boolean
  username:      string | undefined
  isLoading:     boolean
}

export const authState: AuthState = $state({
  authenticated: false,
  username:      undefined,
  isLoading:     true,
})

export function initAuthStore(sessionManager: SessionManager): void {
  authState.authenticated = sessionManager.hasSession()
  authState.username      = sessionManager.hasSession()
    ? sessionManager.currentSession().user.preferred_username
    : undefined
  authState.isLoading = false

  sessionManager.events$.subscribe(event => {
    if (event.type === 'opened') {
      authState.authenticated = true
      authState.username      = event.session.user.preferred_username
    } else if (event.type === 'closed') {
      authState.authenticated = false
      authState.username      = undefined
    }
  })
}
