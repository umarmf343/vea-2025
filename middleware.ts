// This file is now minimal to avoid Edge runtime problems on shared hosting

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  // Only handle essential redirects to minimize memory usage
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
