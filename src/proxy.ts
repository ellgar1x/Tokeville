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
  const isPublicRoute = path === "/landing";
  // API route handlers do their own auth and must never be redirected.
  const isApiRoute = path.startsWith("/api");

  // Unauthenticated users see the landing page first, then login.
  if (!user && !isAuthRoute && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/landing";
    return NextResponse.redirect(url);
  }

  if (user && !isApiRoute) {
    // Authenticated users shouldn't sit on the login or landing page.
    if (isAuthRoute || isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Role + workspace-type gating: members live at /member, institution admins
    // live under /institution, standard admins everywhere else.
    const role = (user.app_metadata?.role as string) ?? "admin";
    const wsType = (user.app_metadata?.workspace_type as string) ?? "standard";
    const isMemberRoute = path === "/member";
    const isInstitutionRoute = path === "/institution" || path.startsWith("/institution/");

    if (role === "member") {
      if (!isMemberRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/member";
        return NextResponse.redirect(url);
      }
    } else if (wsType === "institution") {
      if (!isInstitutionRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/institution";
        return NextResponse.redirect(url);
      }
    } else {
      // Standard admin — keep out of member + institution areas.
      if (isMemberRoute || isInstitutionRoute) {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
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
