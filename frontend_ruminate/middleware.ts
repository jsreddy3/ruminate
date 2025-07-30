import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Protected routes that require authentication
const protectedRoutes = ['/home', '/viewer']
// Public routes that redirect to /home if already authenticated  
const publicRoutes = ['/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check for auth token in cookies
  const cookieToken = request.cookies.get('auth_token')?.value
  const urlToken = request.nextUrl.searchParams.get('token')
  
  // If this is an OAuth callback (has token in URL), let it through to be processed
  if (urlToken) {
    return NextResponse.next()
  }

  // For protected routes - redirect to landing if not authenticated
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!cookieToken) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // For public routes (landing page) - redirect to home if already authenticated
  if (publicRoutes.includes(pathname) && cookieToken) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}