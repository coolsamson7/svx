/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject }   from '@nestjs/common'
import { PassportStrategy }     from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import jwksRsa                  from 'jwks-rsa'

import { AUTH_NESTJS_SETTINGS, AuthNestjsSettings } from './security-nestjs.settings'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AUTH_NESTJS_SETTINGS) settings: AuthNestjsSettings) {
    super({
      jwtFromRequest:    ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration:  false,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache:                 true,
        rateLimit:             true,
        jwksRequestsPerMinute: 5,
        jwksUri:               settings.jwksUri,
      }),
      issuer:     settings.authority,
      audience:   settings.audience,
      algorithms: ['RS256'],
    })
  }

  validate(payload: Record<string, unknown>): Record<string, unknown> {
    return payload
  }
}
