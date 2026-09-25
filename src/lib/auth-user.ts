import type { User } from '@supabase/supabase-js';
import { createServerClient } from './supabase-server';

/**
 * Den inloggade kunden bakom ett API-anrop från appen.
 *
 * Appen skickar sin Supabase-session som `Authorization: Bearer <access_token>`
 * och servern frågar Supabase vem tokenen tillhör. Ett user-id i anropets
 * body går inte att lita på — vem som helst kan skriva vilket id som helst.
 */
export async function userFromRequest(request: Request): Promise<User | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await createServerClient().auth.getUser(token);
  return error ? null : data.user;
}
