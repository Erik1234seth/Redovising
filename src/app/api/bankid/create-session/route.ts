import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Get base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const sessionData = {
      allowedProviders: ['sbid'],
      flow: 'redirect',
      requestedAttributes: [
        'name',
        'firstName',
        'lastName',
        'dateOfBirth',
        'nin'
      ],
      callbackUrls: {
        success: `${baseUrl}/bankid-test?status=success`,
        abort: `${baseUrl}/bankid-test?status=abort`,
        error: `${baseUrl}/bankid-test?status=error`
      },
      language: 'sv'
    };

    const response = await fetch('https://api.signicat.com/auth/rest/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SIGNICAT_API_KEY}`
      },
      body: JSON.stringify(sessionData)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Signicat API error:', data);
      return NextResponse.json(
        { error: 'Failed to create BankID session', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      authenticationUrl: data.authenticationUrl,
      sessionId: data.id
    });
  } catch (error: any) {
    console.error('BankID session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
