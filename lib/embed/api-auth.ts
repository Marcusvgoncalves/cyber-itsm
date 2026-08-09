/**
 * Autenticação das APIs externas do Motor Embarcável (API-First).
 *
 * Contrato: o consumidor envia o header `x-api-key` com o valor da variável
 * de ambiente `EXTERNAL_API_KEY`. A validação ocorre SEMPRE logo após a
 * checagem da Feature Flag (Kill Switch) em cada rota `/api/external/*`.
 */

const EXTERNAL_API_KEY_ENV = 'EXTERNAL_API_KEY';

/**
 * Valida o header `x-api-key` contra `process.env.EXTERNAL_API_KEY`.
 * Retorna `false` se a chave não estiver configurada no servidor (fail-closed).
 */
export function isApiRequestAuthorized(request: Request): boolean {
  const expected = (process.env[EXTERNAL_API_KEY_ENV] || '').trim();

  // Fail-closed: sem chave no servidor, nenhuma requisição externa passa.
  if (!expected || expected.includes('your_')) {
    return false;
  }

  const provided = request.headers.get('x-api-key') || '';
  if (!provided) {
    return false;
  }

  // Comparação em tempo constante para mitigar timing attacks.
  const a = Buffer.from(provided.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return a.equals(b);
}
