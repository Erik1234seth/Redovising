import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Use service role key to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Fetch all users from auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error fetching users:', authError);
      return NextResponse.json(
        { error: 'Could not fetch users' },
        { status: 500 }
      );
    }

    // Get profiles for additional info
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name');

    // Combine auth users with profile data
    const users = authData.users.map((user) => {
      const profile = profiles?.find((p) => p.id === user.id);
      return {
        id: user.id,
        email: user.email || 'Ingen email',
        full_name: profile?.full_name || null,
      };
    });

    // Sort by email
    users.sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error in users API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
