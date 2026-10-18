export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  authCurrentUser?: {
    uid?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerData?: Array<{ providerId: string; email?: string | null }>;
  } | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authCurrentUser?.uid,
      email: authCurrentUser?.email,
      emailVerified: authCurrentUser?.emailVerified,
      isAnonymous: authCurrentUser?.isAnonymous,
      tenantId: authCurrentUser?.tenantId,
      providerInfo: authCurrentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied' || code === 'unauthenticated' || code?.startsWith('auth/')) {
    throw new Error('We could not access your account. Please sign in again and retry.');
  }
  throw new Error('We could not complete your request. Please check your connection and try again. If this continues, contact support.');
}
