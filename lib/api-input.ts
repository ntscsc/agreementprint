export class ApiInputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function readJsonObject(request: { json(): Promise<unknown> }) {
  let body: unknown;
  try { body = await request.json(); }
  catch { throw new ApiInputError('Request body must be valid JSON.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiInputError('Request body must be an object.');
  return body as Record<string, any>;
}

export function inputErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiInputError) return error.status;
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && ['auth/id-token-expired', 'auth/id-token-revoked', 'auth/invalid-id-token', 'auth/argument-error', 'auth/user-disabled', 'auth/user-not-found'].includes(code)) return 401;
  return undefined;
}

export function validDocumentId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}
