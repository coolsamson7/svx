import 'dotenv/config'
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { initializeTransactionalContext } from 'typeorm-transactional'

import { ApplicationModule } from '../../api/src/app/application.module'

async function fetchToken(): Promise<string> {
  const authority = process.env['OIDC_AUTHORITY']
  if (!authority) throw new Error('OIDC_AUTHORITY env var is required')
  const body = new URLSearchParams({
    client_id: 'service-browser',
    grant_type: 'password',
    username:   'admin',
    password:   'admin',
    scope:      'openid',
  })
  const res = await fetch(`${authority}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error(`token fetch failed: ${res.status} ${await res.text()}`)
  return (await res.json() as { access_token: string }).access_token
}

describe('Auth (e2e)', () => {
  let app: INestApplication
  let baseUrl: string
  let token: string

  beforeAll(async () => {
    initializeTransactionalContext()
    const moduleRef = await Test.createTestingModule({ imports: [ApplicationModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.listen(0)
    const server = app.getHttpServer()
    const addr = server.address()
    baseUrl = `http://127.0.0.1:${addr.port}/api`

    token = await fetchToken()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/users/all`)
    expect(res.status).toBe(401)
  })

  it('accepts requests with a valid bearer token', async () => {
    const res = await fetch(`${baseUrl}/users/all`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('rejects requests with a garbage bearer token', async () => {
    const res = await fetch(`${baseUrl}/users/all`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
    })
    expect(res.status).toBe(401)
  })
})
