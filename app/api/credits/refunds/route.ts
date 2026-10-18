import { NextResponse } from 'next/server';
const discontinued = () => NextResponse.json({ error: 'Credit refund requests have been discontinued. Cancel an eligible order before drafting to request a refund to its original payment method.' }, { status: 410 });
export const GET = discontinued;
export const POST = discontinued;
