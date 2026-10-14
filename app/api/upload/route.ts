import { NextResponse } from 'next/server';

// Legacy proof upload endpoint remains retired. Custom samples use their own controlled flow.
export function POST() {
  return NextResponse.json({ error: 'Document uploads are not supported.' }, { status: 410 });
}

export function GET() {
  return NextResponse.json({ error: 'Document uploads are not supported.' }, { status: 410 });
}
