// Hosting failures may return HTML rather than the API's JSON error format.
// Never render that response body or expose it in a customer-facing error.
export async function readApiResponse(response: Response): Promise<Record<string, any>> {
  const unavailable = `The request service is temporarily unavailable (HTTP ${response.status}). Please try again shortly. If this continues, contact support.`;
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error(unavailable);
  }
  let result: unknown;
  try { result = await response.json(); }
  catch { throw new Error(unavailable); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(unavailable);
  const data = result as Record<string, any>;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' && data.error.trim() ? data.error : unavailable);
  }
  return data;
}
