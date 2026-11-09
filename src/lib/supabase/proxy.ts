import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";

/** Paths that never require a login. */
const PUBLIC_PATHS = ["/login", "/setup", "/api/auth", "/api/health"];

/**
 * Runs on every request (see src/proxy.ts). Two jobs:
 *  1. Refresh the Supabase session cookie so it never silently expires.
 *  2. Redirect signed-out visitors to /login and signed-in visitors away from it.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Before Supabase is configured, send everyone to the setup instructions.
  if (!isSupabaseConfigured()) {
    if (pathname.startsWith("/setup") || pathname.startsWith("/api/health")) return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // IMPORTANT: getUser() validates the token with Supabase; do not use getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL(user ? "/dashboard" : "/login", request.url));
  }

  return response;
}
