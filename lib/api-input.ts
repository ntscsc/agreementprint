export class ApiInputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function readJsonObject(request: { json(): Promise<unknown>; body?: ReadableStream<Uint8Array> | null }) {
  let body: unknown;
  try {
    if (request.body) {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 64 * 1024) {
            await reader.cancel();
            throw new ApiInputError('Request body is too large.', 413);
          }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      body = JSON.parse(new TextDecoder().decode(bytes));
    } else body = await request.json();
  }
  catch (error) {
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError('Request body must be valid JSON.');
  }
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
