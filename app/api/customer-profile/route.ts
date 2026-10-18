import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customError, customBody } from '@/lib/custom-request-server';
import { ApiInputError } from '@/lib/api-input';
import { validateCustomerProfile } from '@/lib/customer-profile';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    const data = (await getAdminDb().collection('customerProfiles').doc(identity.uid).get()).data();
    let profile = null;
    try { profile = validateCustomerProfile(data); } catch { /* Incomplete profiles need customer confirmation. */ }
    return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req);
    let profile;
    try { profile = validateCustomerProfile(body); }
    catch (error) { throw new ApiInputError(error instanceof Error ? error.message : 'Check your contact details.'); }
    const ref = getAdminDb().collection('customerProfiles').doc(identity.uid);
    await getAdminDb().runTransaction(async tx => {
      const existing = (await tx.get(ref)).data(), now = new Date().toISOString();
      tx.set(ref, { ...profile, ownerUid: identity.uid, email: identity.email || '', createdAt: existing?.createdAt || now, updatedAt: now }, { merge: true });
    });
    return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
