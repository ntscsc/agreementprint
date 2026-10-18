import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'Use Modify / Replace Order from My Orders. The previous edit form is no longer available.' }, { status: 410 });
}
