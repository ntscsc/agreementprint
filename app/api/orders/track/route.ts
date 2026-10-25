import { ApiInputError, readJsonObject, inputErrorStatus, validDocumentId } from '@/lib/api-input';
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { orderId, phone } = await readJsonObject(req);

    const cleanOrderId = typeof orderId === 'string' ? orderId.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.replace(/[^0-9]/g, '') : '';

    if (!validDocumentId(cleanOrderId)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid Order Reference ID.' },
        { status: 400 }
      );
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { success: false, error: 'Please enter the registered 10-digit mobile number for verification.' },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const now = Date.now(), minute = Math.floor(now / 60_000);
    const globalRef = db.collection('orderTrackingLimits').doc('global');
    const orderLimitRef = db.collection('orderTrackingLimits').doc(createHash('sha256').update(cleanOrderId).digest('hex'));
    await db.runTransaction(async tx => {
      const global = (await tx.get(globalRef)).data();
      const previous = (await tx.get(orderLimitRef)).data();
      const globalCount = global?.minute === minute ? global.count : 0;
      const orderCount = previous?.minute === minute ? previous.count : 0;
      if (globalCount >= 120 || orderCount >= 10) throw new ApiInputError('Too many tracking attempts. Please retry in a minute.', 429);
      tx.set(globalRef, { minute, count: globalCount + 1 });
      tx.set(orderLimitRef, { minute, count: orderCount + 1, expiresAt: new Date(now + 86_400_000) });
    });
    const mapped = /^AP-\d{6}$/i.test(cleanOrderId) ? (await db.collection('publicOrderReferences').doc(cleanOrderId.toUpperCase()).get()).data()?.orderId : cleanOrderId;
    const snap = await db.collection('orders').doc(mapped || '__not_found__').get();
    const notFound = () => NextResponse.json(
      { success: false, error: 'No matching order found. Check the reference and registered mobile number.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );

    if (!snap.exists) {
      return notFound();
    }

    const data = snap.data();
    if (!data) {
      throw new Error('Order document exists but contains no data.');
    }

    // Verify phone against owner phone or tenant phone
    const ownerPhone = typeof data.ownerDetails?.phone === 'string' ? data.ownerDetails.phone.replace(/[^0-9]/g, '') : '';
    const tenantPhone = typeof data.tenantDetails?.phone === 'string' ? data.tenantDetails.phone.replace(/[^0-9]/g, '') : '';

    if (ownerPhone !== cleanPhone && tenantPhone !== cleanPhone) {
      return notFound();
    }

    // Return tracking information (strip private uploaded files and raw Aadhaar/PAN)
    return NextResponse.json({
      success: true,
      order: {
        orderId: data.orderId,
        publicReference: data.publicReference,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        propertyCity: data.propertyDetails?.city,
        propertyType: data.propertyDetails?.propertyType,
        ownerName: data.ownerDetails?.fullName,
        tenantName: data.tenantDetails?.fullName,
        courier: data.courier,
        correctionMessage: data.correctionMessage,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status, headers: status === 429 ? { 'Retry-After': '60', 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' } });
    console.error('Order tracking lookup error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to track order at this moment.' },
      { status: 500 }
    );
  }
}
