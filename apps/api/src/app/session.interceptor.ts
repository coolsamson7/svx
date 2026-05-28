import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable }   from 'rxjs'
import { tokenStorage } from '@svx/security-nestjs'

/**
 * Extracts the Bearer token from every HTTP request and places it into
 * tokenStorage (AsyncLocalStorage). That is the only thing this interceptor
 * does — all session logic (JWT validation, caching, authorization) lives
 * in SessionContextAspect.
 */
@Injectable()
export class SessionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req   = context.switchToHttp().getRequest()
    const token = (req.headers['authorization'] as string | undefined)
      ?.replace('Bearer ', '')
      ?.trim()

    if (!token) return next.handle()

    return new Observable(subscriber => {
      tokenStorage.run(token, () => next.handle().subscribe(subscriber))
    })
  }
}
