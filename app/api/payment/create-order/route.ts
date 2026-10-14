import { NextResponse } from 'next/server';

// Retired legacy integration. Online payments use /api/payment/phonepe/*.
export function POST() {
  return NextResponse.json({ error: 'This legacy payment endpoint is retired. Use PhonePe checkout.' }, { status: 410 });
}
