import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type MiddlewareCookie = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none" | boolean;
    secure?: boolean;
  };
};

function hasSupabasePublicEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function middleware(request: NextRequest) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: MiddlewareCookie[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // /programs is a public page — unauthenticated users may access it freely.
  // But authenticated users with app_deleted_at must still be redirected.
  const isPublicRoute = request.nextUrl.pathname.startsWith("/programs");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

  if (user) {
    // Check whether the user has soft-deleted their app account (Phase S-6).
    // /admin routes are excluded so admins retain access even if app_deleted_at is set.
    // Fail open on DB error to prevent false lockouts.
    if (!isAdminRoute) {
      try {
        const { data: userRow } = await supabase
          .from("users")
          .select("app_deleted_at")
          .eq("id", user.id)
          .maybeSingle<{ app_deleted_at: string | null }>();

        if (userRow?.app_deleted_at) {
          const deletedUrl = request.nextUrl.clone();
          deletedUrl.pathname = "/account-deleted";
          deletedUrl.search = "";
          return NextResponse.redirect(deletedUrl);
        }
      } catch {
        // DB query failed — fail open so legitimate users are not locked out.
        console.error("middleware: app_deleted_at check failed, failing open.");
      }
    }

    return response;
  }

  // No authenticated user.
  // Public routes (/programs) are accessible without login.
  if (isPublicRoute) {
    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/train",
    "/session-history/:path*",
    "/workout-summary/:path*",
    "/exercise-history/:path*",
    "/profile",
    "/gym",
    "/my-exercises",
    "/programs",
    "/programs/:path*"
  ]
};
