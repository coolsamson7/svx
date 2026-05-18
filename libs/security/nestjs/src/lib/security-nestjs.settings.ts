export class AuthNestjsSettings {
  authority!: string
  jwksUri!: string
  audience?: string
  rolesExtractor?: (payload: Record<string, unknown>) => string[]
}

export const AUTH_NESTJS_SETTINGS = Symbol('AUTH_NESTJS_SETTINGS')

export async function discoverJwksUri(authority: string): Promise<string> {
  const res = await fetch(`${authority}/.well-known/openid-configuration`)
  if (!res.ok)
    throw new Error(`OIDC discovery failed for ${authority}: ${res.statusText}`)
  const doc = await res.json() as Record<string, unknown>
  if (!doc['jwks_uri'])
    throw new Error(`No jwks_uri in OIDC discovery document for ${authority}`)
  return doc['jwks_uri'] as string
}
