import { Test, TestingModule }    from '@nestjs/testing'
import { TypeOrmModule }           from '@nestjs/typeorm'
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional'
import { DataSource }              from 'typeorm'
import { UserModule, UserEntity, AddressEntity, UserInventoryServiceController } from '@svx/user-core'
import { UserDto, AddressDto }     from '@svx/user-interface'
import { NestAopModule }                              from './aop/nest-aop.module'
import { tokenStorage, ServerSessionContext, OIDCUser } from '@svx/security'

// ─── Keycloak config (local dev instance) ────────────────────────────────────
const KEYCLOAK_TOKEN_URL = 'http://localhost:8080/realms/service/protocol/openid-connect/token'
const KEYCLOAK_JWKS_URI  = 'http://localhost:8080/realms/service/protocol/openid-connect/certs'
const TEST_USER          = 'coolsamson'
const TEST_PASSWORD      = 'test'
const TEST_CLIENT        = 'service-browser'

async function fetchToken(): Promise<string> {
  const res = await fetch(KEYCLOAK_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type: 'password',
      client_id:  TEST_CLIENT,
      username:   TEST_USER,
      password:   TEST_PASSWORD,
    }),
  })
  const data = await res.json() as any
  if (!data.access_token) throw new Error(`Token fetch failed: ${JSON.stringify(data)}`)
  return data.access_token
}

// ─── Test suite ───────────────────────────────────────────────────────────────
describe('UserInventoryController', () => {
  let app:            TestingModule
  let controller:     UserInventoryServiceController
  let sessionContext: ServerSessionContext<OIDCUser>
  let token:          string

  beforeAll(async () => {
    initializeTransactionalContext()

    // Point ServerSessionContext at our local Keycloak — must be set before module compiles.
    process.env['JWKS_URI'] = KEYCLOAK_JWKS_URI

    app = await Test.createTestingModule({
      imports: [
        NestAopModule,
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            type:        'postgres',
            host:        'localhost',
            port:        5433,
            username:    'postgres',
            password:    'postgres',
            database:    'postgres',
            entities:    [UserEntity, AddressEntity],
            synchronize: true,
          }),
          dataSourceFactory: async (options) => {
            if (!options) throw new Error('Invalid options passed')
            const ds = new DataSource(options)
            await ds.initialize()
            try { addTransactionalDataSource(ds) }
            catch (err: any) { if (!err?.message?.includes('has already added')) throw err }
            return ds
          },
        }),
        UserModule,
      ],
    }).compile()

    controller     = app.get(UserInventoryServiceController)
    sessionContext = app.get(ServerSessionContext)

    // Get a real token from Keycloak — SessionContextAspect will validate it on
    // first controller call via establish() (JWKS fetch + RSA verify + cache).
    token = await fetchToken()
    console.log('Fetched token for:', TEST_USER)
  })

  // HTTP path: simulates SessionInterceptor — puts the raw Bearer token into
  // tokenStorage; SessionContextAspect picks it up via establish().
  function withSession<T>(fn: () => Promise<T>): Promise<T> {
    return tokenStorage.run(token, fn)
  }

  // Messaging path: simulates a subscriber adapter — constructs a Session
  // directly from message headers and passes it via sessionContext.run().
  // SessionContextAspect sees it in current() and skips JWT work entirely.
  function withDirectSession<T>(fn: () => Promise<T>): Promise<T> {
    const session = {
      user: {
        sub:                'system',
        name:               'System User',
        given_name:         'System',
        family_name:        'User',
        email:              'system@internal',
        email_verified:     'true',
        preferred_username: 'system',
      } satisfies OIDCUser,
      ticket: { token: '' },
    }
    return sessionContext.run(session, fn)
  }

  // ─── Tests ────────────────────────────────────────────────────────────────

  it('rejects call with no session', async () => {
    // No tokenStorage, no sessionStorage — aspect must throw UnauthorizedException.
    // If this resolves instead of throwing, the aspect is not being woven.
    try {
      await controller.findAll()
      throw new Error('Expected UnauthorizedException but call succeeded')
    } catch (err: any) {
      expect(err.status).toBe(401)
    }
  })

  it('findAll returns users (JWT path)', async () => {
    const users = await withSession(() => controller.findAll())
    console.log('users:', users)
    expect(Array.isArray(users)).toBe(true)
  })

  it('findAll returns users (direct session path)', async () => {
    const users = await withDirectSession(() => controller.findAll())
    expect(Array.isArray(users)).toBe(true)
  })

  it('create, read, update round-trip (JWT path)', async () => {
    const dto      = new UserDto()
    dto.name       = 'Test User'
    dto.email      = 'test@example.com'
    dto.addresses  = [Object.assign(new AddressDto(), { city: 'Cologne' })]

    const created = await withSession(() => controller.create(dto))
    expect(created.id).toBeDefined()

    const read = await withSession(() => controller.findOne(created.id!))
    expect(read.name).toBe('Test User')

    read.name = 'Test User Updated'
    const updated = await withSession(() => controller.update(read))
    expect(updated.name).toBe('Test User Updated')
  })
})
