import { Module, Logger }      from '@nestjs/common'
import { APP_INTERCEPTOR }     from '@nestjs/core'
import { TypeOrmModule }       from '@nestjs/typeorm'
import { DataSource }          from 'typeorm'
import { addTransactionalDataSource } from 'typeorm-transactional'

import { SecurityNestjsModule, discoverJwksUri, NestAopModule } from '@svx/security-nestjs'
import { SessionContext, SessionContextBuilder, CachingSessionStore, sessionStorage, tokenStorage, JwtSessionFactory, OIDCUser, AuthorizationManager, RequiresRoleFactory } from '@svx/security'
import { UserModule, UserEntity, AddressEntity } from '@svx/user-core'

import { SessionContextAspect }  from './aop/session-context.aspect'
import { SchemaValidationAspect } from './aop/schema-validation.aspect'
import { UserLoggingAspect }     from './aop/user-logging.aspect'
import { AuthorizationAspect }   from './aop/authorization-aspect'
import { PackagesController }    from './packages.controller'
import { SessionInterceptor }    from './session.interceptor'

@Module({
  imports: [
    NestAopModule.forRoot(),

    SecurityNestjsModule.forRootAsync({
      useFactory: async () => {
        const authority = process.env['OIDC_AUTHORITY'];
        if (!authority) throw new Error('OIDC_AUTHORITY env var is required');
        return {
          authority,
          jwksUri: await discoverJwksUri(authority),
        };
      },
    }),

    TypeOrmModule.forRootAsync({
      useFactory: () => {
        Logger.log('Initializing TypeORM...', 'TypeOrmFactory')
        return {
          type:      'postgres',
          host:      process.env['DB_HOST']     ?? 'localhost',
          port:      Number(process.env['DB_PORT'] ?? 5433),
          username:  process.env['DB_USER']     ?? 'postgres',
          password:  process.env['DB_PASSWORD'] ?? 'postgres',
          database:  process.env['DB_NAME']     ?? 'postgres',
          entities:  [UserEntity, AddressEntity],
          synchronize: process.env['NODE_ENV'] !== 'production',
        }
      },
      async dataSourceFactory(options) {
        if (!options) throw new Error('Invalid options passed')
        Logger.log('Creating DataSource...', 'TypeOrmFactory')
        const dataSource = new DataSource(options)
        await dataSource.initialize()
        try {
          addTransactionalDataSource(dataSource)
        } catch (err: any) {
          if (!err?.message?.includes('has already added')) throw err
        }
        return dataSource
      },
    }),

    UserModule,
  ],

  controllers: [PackagesController],

  providers: [
    {
      provide:    SessionContext,
      useFactory: () => new SessionContextBuilder<OIDCUser>()
        .environment({ get: () => tokenStorage.getStore() ?? null })
        .factory(new JwtSessionFactory<OIDCUser>(
          { jwksUri: process.env['JWKS_URI'] ?? '' },
          claims => ({
            sub:                String(claims['sub']                ?? ''),
            given_name:         String(claims['given_name']         ?? ''),
            family_name:        String(claims['family_name']        ?? ''),
            email:              String(claims['email']              ?? ''),
            email_verified:     String(claims['email_verified']     ?? ''),
            name:               String(claims['name']              ?? ''),
            preferred_username: String(claims['preferred_username'] ?? ''),
          }),
        ))
        .store(new CachingSessionStore())
        .directSession(() => sessionStorage.getStore() ?? null)
        .build(),
    },
    SessionContextAspect,
    SchemaValidationAspect,
    UserLoggingAspect,
    AuthorizationAspect,
    AuthorizationManager,
    RequiresRoleFactory,
    { provide: APP_INTERCEPTOR, useClass: SessionInterceptor },
  ],
})
export class ApplicationModule {}
