import { Module, DynamicModule } from '@nestjs/common'
import { APP_GUARD }            from '@nestjs/core'
import { PassportModule }       from '@nestjs/passport'

import { AUTH_NESTJS_SETTINGS, AuthNestjsSettings } from './auth-nestjs.settings'
import { JwtStrategy }      from './jwt.strategy'
import { JwtAuthGuard }     from './jwt-auth.guard'
import { PermissionsGuard } from './permissions.guard'

export interface AuthNestjsModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<AuthNestjsSettings> | AuthNestjsSettings
  inject?: any[]
  imports?: any[]
}

@Module({})
export class AuthNestjsModule {
  static forRoot(settings: AuthNestjsSettings): DynamicModule {
    return AuthNestjsModule.buildModule([
      { provide: AUTH_NESTJS_SETTINGS, useValue: settings },
    ])
  }

  static forRootAsync(options: AuthNestjsModuleAsyncOptions): DynamicModule {
    return AuthNestjsModule.buildModule(
      [
        {
          provide:    AUTH_NESTJS_SETTINGS,
          useFactory: options.useFactory,
          inject:     options.inject ?? [],
        },
      ],
      options.imports,
    )
  }

  private static buildModule(settingsProviders: any[], extraImports: any[] = []): DynamicModule {
    return {
      module:  AuthNestjsModule,
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), ...extraImports],
      providers: [
        ...settingsProviders,
        JwtStrategy,
        // apply both guards globally — JwtAuthGuard validates signature,
        // PermissionsGuard checks roles. Use @Public() to opt out of JWT check.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
      exports: [],
    }
  }
}
