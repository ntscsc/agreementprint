interface PhonePeCredentials {
  clientId: string;
  clientSecret: string;
  clientVersion: string;
  production: boolean;
}

interface PhonePeTokenResponse {
  access_token: string;
  expires_at: number;
}

export interface PhonePeRefundResponse {
  merchantRefundId?: string;
  originalMerchantOrderId?: string;
  refundId?: string;
  amount?: number;
  state?: string;
  emptyResponse?: boolean;
}

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

export function getPhonePeCredentials(): PhonePeCredentials | null {
  const { PHONEPE_CLIENT_ID, PHONEPE_CLIENT_SECRET, PHONEPE_CLIENT_VERSION } = process.env;
  if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET || !PHONEPE_CLIENT_VERSION) return null;

  return {
    clientId: PHONEPE_CLIENT_ID,
    clientSecret: PHONEPE_CLIENT_SECRET,
    clientVersion: PHONEPE_CLIENT_VERSION,
    production: process.env.PHONEPE_ENV === 'production',
  };
}

export function getPhonePeApiBase(production: boolean) {
  return production
    ? 'https://api.phonepe.com/apis/pg'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
}

export async function getPhonePeAccessToken(credentials: PhonePeCredentials): Promise<string> {
  if (cachedToken && cachedTokenExpiry > Date.now() + 60_000) return cachedToken;

  const tokenUrl = credentials.production
    ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
  const form = new URLSearchParams({
    client_id: credentials.clientId,
    client_version: credentials.clientVersion,
    client_secret: credentials.clientSecret,
    grant_type: 'client_credentials',
  });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error('PhonePe OAuth token request failed:', response.status);
    throw new Error('PhonePe authentication failed. Check the server credentials.');
  }

  const token = await response.json() as PhonePeTokenResponse;
  if (!token.access_token || typeof token.expires_at !== 'number') {
    throw new Error('PhonePe returned an invalid access token response.');
  }

  cachedToken = token.access_token;
  cachedTokenExpiry = token.expires_at * 1000;
  return cachedToken;
}

export async function fetchPhonePeOrderStatus(
  credentials: PhonePeCredentials,
  accessToken: string,
  merchantOrderId: string,
) {
  const response = await fetch(
    `${getPhonePeApiBase(credentials.production)}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status`,
    {
      headers: { Authorization: `O-Bearer ${accessToken}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    console.error('PhonePe order status request failed:', response.status);
    throw Object.assign(new Error('Could not verify payment status with PhonePe.'), { status: response.status });
  }
  return response.json() as Promise<{
    state?: string;
    amount?: number;
    expireAt?: number;
    paymentDetails?: Array<{ state?: string; transactionId?: string }>;
  }>;
}

export async function phonePeRefundRequest(merchantRefundId: string, originalMerchantOrderId?: string, amount?: number): Promise<PhonePeRefundResponse> {
  const credentials = getPhonePeCredentials();
  if (!credentials) throw new Error('Online refunds are temporarily unavailable.');
  const token = await getPhonePeAccessToken(credentials);
  const response = await fetch(`${getPhonePeApiBase(credentials.production)}/payments/v2/refund${originalMerchantOrderId ? '' : `/${encodeURIComponent(merchantRefundId)}/status`}`, {
    method: originalMerchantOrderId ? 'POST' : 'GET',
    headers: { Authorization: `O-Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(originalMerchantOrderId ? { body: JSON.stringify({ merchantRefundId, originalMerchantOrderId, amount }) } : {}),
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  const body = await response.text();
  let result: Record<string, unknown> = {};
  if (body.trim()) {
    try { result = JSON.parse(body); }
    catch { throw new Error('PhonePe returned an unreadable refund response. The refund remains unconfirmed; check its status before retrying.'); }
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('PhonePe returned an invalid refund response. The refund remains unconfirmed.');
  }
  if (!response.ok) {
    const code = typeof result.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(result.code) ? result.code : undefined;
    console.error('PhonePe refund request failed:', { operation: originalMerchantOrderId ? 'submit' : 'status', httpStatus: response.status, code });
    const message = response.status === 401 || response.status === 403
      ? 'PhonePe did not authorise this refund request. Check the configured payment credentials and refund access. The refund remains unconfirmed.'
      : `PhonePe could not ${originalMerchantOrderId ? 'submit' : 'check'} the refund (HTTP ${response.status}${code ? `, ${code}` : ''}). The refund remains unconfirmed; check its status before retrying.`;
    throw Object.assign(new Error(message), { status: response.status, code });
  }
  // Empty sandbox responses are unconfirmed, never evidence of success or failure.
  if (!body.trim()) return { state: 'UNKNOWN', emptyResponse: true };
  return result as PhonePeRefundResponse;
}
