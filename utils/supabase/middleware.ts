// Import from SSR entry to avoid bundling browser client into Edge runtime
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import type { NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check if the request is for the admin page
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      // If there's no user, redirect to the login page
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // Check if the user is a super admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_super_admin) {
      // If the user is not a super admin, redirect to the unauthorized page
      const url = request.nextUrl.clone();
      url.pathname = "/unauthorized";
      return NextResponse.redirect(url);
    }
  } else if (
    !user &&
    !["/auth", "/sign-in", "/sign-up", "/reset-password", "/error"].includes(
      request.nextUrl.pathname,
    )
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();

    // if the url.search contains a token, remove it from the url object and append it to the redirect url
    url.pathname = "/sign-in";
    if (url.search.includes("token")) {
      const token = url.search.split("token=")[1];
      url.searchParams.delete("token");
      url.searchParams.set(
        "redirect",
        request.nextUrl.pathname + "?token=" + token,
      );
    } else {
      url.searchParams.set("redirect", request.nextUrl.pathname);
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
