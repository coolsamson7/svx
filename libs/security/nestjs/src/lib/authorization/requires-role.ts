import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common'
import { Invocation } from '@svx/di'
import { TypeDescriptor, MethodDescriptor } from '@svx/common'
import { Authorization, AuthorizationFactory, AuthorizationManager } from './authorization-manager'
import { SessionContext } from '@svx/security';


// ─── decorator ────────────────────────────────────────────────────────────────

/**
 * Method decorator. Registers a role requirement that is evaluated against the
 * current session's `roles` claim (or `realm_access.roles` for Keycloak tokens).
 * Any one of the listed roles is sufficient (OR semantics).
 *
 * @example
 * @RequiresRole('admin', 'support')
 * async deleteUser(id: number) { ... }
 */
export function RequiresRole(...roles: string[]): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    TypeDescriptor
      .forType((target as any).constructor)
      .addMethodDecorator(target, propertyKey as string, RequiresRole, ...roles)
  }
}

// ─── check ────────────────────────────────────────────────────────────────────

class RoleAuthorization extends Authorization {
  constructor(
    private readonly required: string[],
    private readonly sessionContext: SessionContext,
  ) {
    super()
  }

  authorize(_invocation: Invocation): void {
    const session = this.sessionContext.current()
    if (!session) throw new ForbiddenException('No active session')

    // Keycloak: realm_access.roles; custom tokens: top-level roles claim.
    const user = session.user as any
    const roles: string[] = user?.roles ?? user?.realm_access?.roles ?? []

    if (!this.required.some(r => roles.includes(r)))
      throw new ForbiddenException(`Requires role: ${this.required.join(' or ')}`)
  }
}

// ─── factory ──────────────────────────────────────────────────────────────────

/** Produces RoleAuthorization checks for methods decorated with @RequiresRole. */
@Injectable()
export class RequiresRoleFactory extends AuthorizationFactory implements OnModuleInit {
  readonly decorators = [RequiresRole]

  constructor(
    private readonly authManager: AuthorizationManager,
    private readonly sessionContext: SessionContext,
  ) {
    super()
  }

  onModuleInit() {
    this.authManager.registerFactory(this)
  }

  computeAuthorization(method: MethodDescriptor): Authorization {
    const dec = method.getDecorator(RequiresRole)!
    return new RoleAuthorization(dec.arguments as string[], this.sessionContext)
  }
}
