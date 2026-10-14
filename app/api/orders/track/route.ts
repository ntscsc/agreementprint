import { readJsonObject, inputErrorStatus, validDocumentId } from '@/lib/api-input';
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

    if (!cleanPhone || cleanPhone.length !== 10) {
      return NextResponse.json(
        { success: false, error: 'Please enter the registered 10-digit mobile number for verification.' },
        { status: 400 }
      );
    }

    const snap = await getAdminDb().collection('orders').doc(cleanOrderId).get();

    if (!snap.exists) {
      return NextResponse.json(
        { success: false, error: 'No order found with this Reference ID. Please verify and retry.' },
        { status: 404 }
      );
    }

    const data = snap.data();
    if (!data) {
      throw new Error('Order document exists but contains no data.');
    }

    // Verify phone against owner phone or tenant phone
    const ownerPhone = data.ownerDetails?.phone?.replace(/[^0-9]/g, '');
    const tenantPhone = data.tenantDetails?.phone?.replace(/[^0-9]/g, '');

    if (ownerPhone !== cleanPhone && tenantPhone !== cleanPhone) {
      return NextResponse.json(
        {
          success: false,
          error: 'The mobile number provided does not match the records for this order.',
        },
        { status: 403 }
      );
    }

    // Return tracking information (strip private uploaded files and raw Aadhaar/PAN)
    return NextResponse.json({
      success: true,
      order: {
        orderId: data.orderId,
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
    });
  } catch (error) {
    const status = inputErrorStatus(error);
    if (status) return NextResponse.json({ error: status === 401 ? 'Sign in again to continue.' : (error as Error).message }, { status });
    console.error('Order tracking lookup error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to track order at this moment.' },
      { status: 500 }
    );
  }
}
