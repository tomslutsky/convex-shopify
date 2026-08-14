import { SignJWT, importJWK } from 'jose'
import { env } from '../_generated/server'
import type { JWK } from 'jose'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function requiredEnv(name: keyof typeof env) {
  const value = env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function parseJwk(name: 'APP_AUTH_PRIVATE_JWK' | 'APP_AUTH_PUBLIC_JWK'): JWK {
  const value: unknown = JSON.parse(requiredEnv(name))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must contain a JSON Web Key`)
  const jwk = value as JWK
  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error(`${name} must contain an EC P-256 JSON Web Key`)
  }
  if (name === 'APP_AUTH_PRIVATE_JWK' && typeof jwk.d !== 'string') throw new Error(`${name} must contain private key material`)
  if (name === 'APP_AUTH_PUBLIC_JWK' && 'd' in jwk) throw new Error(`${name} must not contain private key material`)
  return jwk
}

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

export async function signAppToken(shopDomain: string, shopifyUserId: string) {
  const jwk = parseJwk('APP_AUTH_PRIVATE_JWK')
  const key = await importJWK(jwk, 'ES256')
  return new SignJWT({ shopDomain, shopifyUserId })
    .setProtectedHeader({ alg: 'ES256', kid: jwk.kid ?? 'app-auth-1' })
    .setIssuer(requiredSystemEnv('CONVEX_SITE_URL'))
    .setAudience('convex')
    .setSubject(`${shopDomain}:${shopifyUserId}`)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key)
}

function requiredSystemEnv(name: 'CONVEX_SITE_URL') {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured`)
  return value
}
