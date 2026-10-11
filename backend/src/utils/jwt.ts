/**
 * Cryptographic JWT utilities for JobPilot International backend.
 * Uses the Web Crypto API (crypto.subtle) native to Cloudflare Workers and Node.js.
 * Algorithm: HMAC-SHA256 (HS256).
 */

export interface JwtPayload {
  sub: string; // User ID
  email?: string;
  exp: number; // Expiration timestamp in seconds
  iat?: number; // Issued at timestamp in seconds
  role?: string;
  [key: string]: any;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToUint8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

async function getCryptoKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const secretBytes = stringToUint8(secret);
  return crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  );
}

/**
 * Signs a JWT with HMAC-SHA256.
 */
export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(stringToUint8(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(stringToUint8(JSON.stringify(payload)));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const key = await getCryptoKey(secret, 'sign');
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    stringToUint8(dataToSign)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signatureBuffer));
  return `${dataToSign}.${signatureB64}`;
}

/**
 * Cryptographically verifies a JWT token and returns the payload if valid.
 */
export async function verifyJwt(
  token: string,
  secret: string
): Promise<{ valid: boolean; payload?: JwtPayload; error?: string }> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, error: 'Malformed JWT: must contain 3 parts separated by dots' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const dataToVerify = `${headerB64}.${payloadB64}`;
    const signatureBytes = base64UrlDecode(signatureB64);

    const key = await getCryptoKey(secret, 'verify');
    const isValidSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      stringToUint8(dataToVerify)
    );

    if (!isValidSignature) {
      return { valid: false, error: 'Invalid JWT signature: token was tampered with or signed by unknown authority' };
    }

    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const payload: JwtPayload = JSON.parse(payloadJson);

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'JWT token has expired' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to verify JWT' };
  }
}
