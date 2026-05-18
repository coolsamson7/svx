import { Module, DynamicModule } from '@nestjs/common'
import { APP_GUARD }            from '@nestjs/core'
import { PassportModule }       from '@nestjs/passport'

import { AUTH_NESTJS_SETTINGS, AuthNestjsSettings } from './security-nestjs.settings'
import { JwtStrategy }      from './jwt.strategy'
import { JwtAuthGuard }     from './jwt-auth.guard'
import { PermissionsGuard } from './permissions.guard'

export interface SecurityNestjsModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<AuthNestjsSettings> | AuthNestjsSettings
  inject?: any[]
  imports?: any[]
}

@Module({})
export class SecurityNestjsModule {
  static forRoot(settings: AuthNestjsSettings): DynamicModule {
    return SecurityNestjsModule.buildModule([
      { provide: AUTH_NESTJS_SETTINGS, useValue: settings },
    ])
  }

  static forRootAsync(options: SecurityNestjsModuleAsyncOptions): DynamicModule {
    return SecurityNestjsModule.buildModule(
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
      module:  SecurityNestjsModule,
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), ...extraImports],
      providers: [
        ...settingsProviders,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
      exports: [],
    }
  }
}
