/**
 * Next.js 16 proxy (replaces middleware.ts).
 * TODO: Uncomment clerkMiddleware once Clerk keys are configured.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TODO: Add Firebase Authentication (anonymous auth or email) before production
// TODO: Uncomment and configure Clerk once NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set:
//
// import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
//
// const isPublicRoute = createRouteMatcher(["/sign-in(.*)"]);
//
// export const proxy = clerkMiddleware((auth, req) => {
//   if (!isPublicRoute(req)) auth().protect();
// });

export function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
