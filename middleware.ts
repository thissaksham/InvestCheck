import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // API routes handle their own auth (cron secret / session); skip statics.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|ico|webmanifest)$).*)"],
};
