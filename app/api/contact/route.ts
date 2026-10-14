import { createHash, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiInputError, inputErrorStatus, readJsonObject } from '@/lib/api-input';

export async function POST(req: NextRequest) {
  try {
    const body = await readJsonObject(req);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.replace(/[^0-9]/g, '') : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const district = body.district === undefined || body.district === '' ? 'Not specified' : body.district;
    if (name.length < 2 || name.length > 100) throw new ApiInputError('Enter a name between 2 and 100 characters.');
    if (!/^[6-9]\d{9}$/.test(phone)) throw new ApiInputError('Enter a valid 10-digit Indian mobile number.');
    if (message.length < 5 || message.length > 1000) throw new ApiInputError('Enter a message between 5 and 1000 characters.');
    if (typeof district !== 'string' || district.trim().length < 2 || district.length > 100) throw new ApiInputError('Enter a valid district.');
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    const db = getAdminDb();
    const globalRef = db.collection('enquiryLimits').doc('global');
    const phoneRef = db.collection('enquiryLimits').doc(hash(phone));
    const enquiryId = `ENQ_${randomUUID()}`;
    const enquiryRef = db.collection('enquiries').doc(enquiryId);
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    const hour = Math.floor(now / 3_600_000);
    await db.runTransaction(async (tx) => {
      const global = (await tx.get(globalRef)).data();
      const previous = (await tx.get(phoneRef)).data();
      const globalCount = global?.minute === minute ? global.count : 0;
      const phoneCount = previous?.hour === hour ? previous.count : 0;
      if (globalCount >= 30 || phoneCount >= 3 || (previous?.messageHash === hash(message) && now - previous.lastSubmitted < 60_000)) throw new ApiInputError('Too many enquiries. Please try again later.', 429);
      tx.set(globalRef, { minute, count: globalCount + 1 });
      tx.set(phoneRef, { hour, count: phoneCount + 1, messageHash: hash(message), lastSubmitted: now, expiresAt: new Date(now + 86_400_000) });
      tx.create(enquiryRef, { enquiryId, name, phone, district: district.trim(), message, status: 'New', createdAt: new Date(now).toISOString() });
    });
    return NextResponse.json({ success: true, enquiryId, message: 'Enquiry successfully submitted and recorded.' });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ success: false, error: (error as Error).message }, { status, headers: status === 429 ? { 'Retry-After': '3600' } : {} });
    console.error('Contact submission error:', error);
    return NextResponse.json({ success: false, error: 'Unable to save your enquiry. Please try again later.' }, { status: 503 });
  }
}
