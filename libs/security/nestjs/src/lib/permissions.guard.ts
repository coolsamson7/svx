/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { PERMISSIONS_KEY }                           from './permissions.decorator'
import { IS_PUBLIC_KEY }                             from './public.decorator'
import { AUTH_NESTJS_SETTINGS, AuthNestjsSettings }  from './security-nestjs.settings'

const defaultRolesExtractor = (payload: Record<string, unknown>): string[] =>
  ((payload['realm_access'] as any)?.roles ?? []) as string[]

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_NESTJS_SETTINGS) private readonly settings: AuthNestjsSettings,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!required || required.length === 0) return true

    const { user } = ctx.switchToHttp().getRequest()
    if (!user) return false

    const extract = this.settings.rolesExtractor ?? defaultRolesExtractor
    const roles   = extract(user as Record<string, unknown>)

    return required.every(p => roles.includes(p))
  }
}
