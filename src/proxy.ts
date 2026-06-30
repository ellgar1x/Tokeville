import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (formerly Middleware). Refreshes the Supabase auth session
 * on every request and gates the app behind login.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path === "/login" || path.startsWith("/auth");
  // API route handlers do their own auth and must never be redirected.
  const isApiRoute = path.startsWith("/api");

  // Unauthenticated users are sent to /login (except auth + API routes).
  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isApiRoute) {
    // Authenticated users shouldn't sit on the login page.
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Role-based gating: members live at /member, admins everywhere else.
    const role = (user.app_metadata?.role as string) ?? "admin";
    const isMemberRoute = path === "/member";
    if (role === "member" && !isMemberRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/member";
      return NextResponse.redirect(url);
    }
    if (role === "admin" && isMemberRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and image files so the session is
     * kept fresh everywhere the user navigates.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
