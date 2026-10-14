import { NextResponse } from 'next/server';

// Retired legacy integration; this endpoint cannot modify order payments.
export function POST() {
  return NextResponse.json({ error: 'This legacy payment webhook is retired.' }, { status: 410 });
}
