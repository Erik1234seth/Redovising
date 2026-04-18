import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('EMAIL WEBHOOK RECEIVED:', JSON.stringify(body, null, 2));
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
