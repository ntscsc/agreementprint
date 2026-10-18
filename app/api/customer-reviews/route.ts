import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { customIdentity, customBody, customError } from '@/lib/custom-request-server';
import { ApiInputError, validDocumentId } from '@/lib/api-input';
import { AggregateField } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
const json = (body: unknown) => NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb(), scope = req.nextUrl.searchParams.get('scope');
    if (!scope) {
      const published = db.collection('publishedCustomerReviews');
      const [records, aggregate] = await Promise.all([
        published.orderBy('publishedAt', 'desc').limit(50).get(),
        published.aggregate({ count: AggregateField.count(), totalStars: AggregateField.sum('rating') }).get(),
      ]);
      const { count, totalStars } = aggregate.data();
      return json({ summary: { count, totalStars, average: count ? totalStars / count : 0 }, reviews: records.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, name: data.name, rating: data.rating, comment: data.comment, publishedAt: data.publishedAt };
      }) });
    }
    const identity = await customIdentity(req);
    if (scope === 'mine') {
      const record = (await db.collection('customerReviews').doc(identity.uid).get()).data();
      return json({ review: record ? { rating: record.rating, comment: record.comment, publicConsent: record.publicConsent, status: record.status, updatedAt: record.updatedAt } : null });
    }
    if (scope !== 'admin' || !identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const records = await db.collection('customerReviews').orderBy('updatedAt', 'desc').limit(100).get();
    return json({ reviews: records.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch (error) { return customError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req), db = getAdminDb();
    const { rating, comment } = body;
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiInputError('Choose a rating from 1 to 5 stars.');
    if (typeof comment !== 'string' || comment.trim().length < 10 || comment.length > 2000) throw new ApiInputError('Write a review between 10 and 2,000 characters.');
    const ref = db.collection('customerReviews').doc(identity.uid);
    await db.runTransaction(async tx => {
      const profile = (await tx.get(db.collection('customerProfiles').doc(identity.uid))).data();
      const previous = (await tx.get(ref)).data();
      if (typeof profile?.name !== 'string' || !profile.name.trim()) throw new ApiInputError('Save your name in My Account before submitting feedback.', 409);
      const now = new Date().toISOString();
      tx.set(ref, { name: profile.name.trim().slice(0, 100), rating, comment: comment.trim(), publicConsent: true, status: 'Published', createdAt: previous?.createdAt || now, updatedAt: now });
      tx.set(db.collection('publishedCustomerReviews').doc(identity.uid), { name: profile.name.trim().slice(0, 100), rating, comment: comment.trim(), publishedAt: now });
    });
    return json({ success: true });
  } catch (error) { return customError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = await customIdentity(req), body = await customBody(req), db = getAdminDb();
    if (!identity.admin) throw new ApiInputError('Administrator access required.', 403);
    const { id, action } = body;
    if (!validDocumentId(id) || (action !== 'publish' && action !== 'hide')) throw new ApiInputError('Choose a review and moderation action.');
    await db.runTransaction(async tx => {
      const ref = db.collection('customerReviews').doc(id), record = (await tx.get(ref)).data();
      if (!record) throw new ApiInputError('Review not found.', 404);
      if (record.updatedAt !== body.updatedAt) throw new ApiInputError('This review changed. Refresh before moderating it.', 409);
      const published = db.collection('publishedCustomerReviews').doc(id), now = new Date().toISOString();
      if (action === 'publish') {
        if (!record.publicConsent) throw new ApiInputError('Private feedback cannot be published.', 409);
        tx.set(published, { name: record.name, rating: record.rating, comment: record.comment, publishedAt: now });
      } else tx.delete(published);
      tx.update(ref, { status: action === 'publish' ? 'Published' : 'Hidden', moderatedBy: identity.uid, moderatedAt: now, updatedAt: now });
    });
    return json({ success: true });
  } catch (error) { return customError(error); }
}
