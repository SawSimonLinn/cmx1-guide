import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const destination = new URL('/', url.origin);
  const response = NextResponse.redirect(destination);
  const cookieStore = await cookies();
  if (code && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(toSet: {name:string;value:string;options:CookieOptions}[]) {
            toSet.forEach(({name,value,options}) => {
              cookieStore.set(name,value,options);
              response.cookies.set(name,value,options);
            });
          }
        }
      }
    );
    const {error} = await client.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/?auth_error=1',url.origin));
  }
  return response;
}
