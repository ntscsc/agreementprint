import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customBody, customError } from '@/lib/custom-request-server';
import { ApiInputError } from '@/lib/api-input';
import { VENDOR_CONFIG } from '@/src/config/vendor';

export const runtime = 'nodejs';
const defaults = { name: VENDOR_CONFIG.tradeName, address: '', phone: VENDOR_CONFIG.phone };

export async function GET(req: NextRequest) {
  try {
    if (!(await customIdentity(req)).admin) throw new ApiInputError('Administrator access required.', 403);
    const saved = (await getAdminDb().collection('adminPreferences').doc('envelopeSender').get()).data();
    return NextResponse.json({ sender: saved ? { name: saved.name, address: saved.address, phone: saved.phone || '' } : defaults }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req);
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const { name, address, phone } = await customBody(req);
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) throw new ApiInputError('Enter a sender name between 2 and 100 characters.');
    if (typeof address !== 'string' || address.trim().length < 5 || address.length > 1000) throw new ApiInputError('Enter the complete sender address (5–1,000 characters).');
    if (typeof phone !== 'string' || phone.length > 30 || (phone.trim() && !/^[+0-9 ()-]{7,30}$/.test(phone.trim()))) throw new ApiInputError('Enter a valid sender phone number, or leave it blank.');
    const sender = { name: name.trim(), address: address.trim(), phone: phone.trim() };
    await getAdminDb().collection('adminPreferences').doc('envelopeSender').set({ ...sender, updatedBy: identity.uid, updatedAt: new Date().toISOString() });
    return NextResponse.json({ sender }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return customError(error); }
}
