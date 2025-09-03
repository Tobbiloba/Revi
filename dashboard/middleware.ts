import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth checks for API routes and static files
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/payments/webhooks")
  ) {
    return NextResponse.next();
  }

  // Get the better-auth session token from cookies
  const sessionToken = request.cookies.get("better-auth.session_token")?.value;
  
  console.log(`[Middleware] Path: ${pathname}, Session token: ${sessionToken ? 'exists' : 'none'}`);

  // If user has session and tries to access auth pages, redirect to dashboard
  if (sessionToken && ["/sign-in", "/sign-up"].includes(pathname)) {
    console.log(`[Middleware] Redirecting authenticated user from ${pathname} to /dashboard`);
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If user has no session and tries to access protected pages, redirect to sign-in
  if (!sessionToken && pathname.startsWith("/dashboard")) {
    console.log(`[Middleware] Redirecting unauthenticated user from ${pathname} to /sign-in`);
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in", "/sign-up"],
};
