import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    const response = await fetch(
      `https://api.signicat.com/auth/rest/sessions/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SIGNICAT_API_KEY}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Signicat API error:', data);
      return NextResponse.json(
        { error: 'Failed to fetch session data', details: data },
        { status: response.status }
      );
    }

    // Check if session is successful
    if (data.status !== 'SUCCESS') {
      return NextResponse.json(
        { error: 'Session not completed', status: data.status },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: data.status,
      subject: data.subject
    });
  } catch (error: any) {
    console.error('BankID session fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
