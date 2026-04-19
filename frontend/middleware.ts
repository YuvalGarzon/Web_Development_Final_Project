import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware for Afeka Trip Planner 2026
// Verifies JWT tokens for every page access and implements silent refresh

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://backend:4000';
const PUBLIC_PATHS = ['/', '/login', '/register'];
const AUTH_PATHS = ['/planning', '/history'];

// Check if path requires authentication
function requiresAuth(pathname: string): boolean {
  // Public paths don't require auth
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
    return false;
  }
  
  // Auth paths require authentication
  if (AUTH_PATHS.some(path => pathname.startsWith(path))) {
    return true;
  }
  
  // Default: require auth for other paths
  return true;
}

// Verify access token with backend
async function verifyAccessToken(request: NextRequest): Promise<{ isValid: boolean; user?: any }> {
  try {
    // Get cookies from request
    const cookies = request.cookies;
    const accessToken = cookies.get('access_token')?.value;
    
    if (!accessToken) {
      return { isValid: false };
    }
    
    // Verify token with backend
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Cookie': `access_token=${accessToken}`,
      },
      credentials: 'include',
    });
    
    if (response.ok) {
      const data = await response.json();
      return { isValid: true, user: data.user };
    }
    
    return { isValid: false };
  } catch (error) {
    console.error('Token verification failed:', error);
    return { isValid: false };
  }
}

// Attempt silent refresh
async function attemptSilentRefresh(request: NextRequest): Promise<boolean> {
  try {
    const cookies = request.cookies;
    const refreshToken = cookies.get('refresh_token')?.value;
    
    if (!refreshToken) {
      return false;
    }
    
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': `refresh_token=${refreshToken}`,
      },
      credentials: 'include',
    });
    
    return response.ok;
  } catch (error) {
    console.error('Silent refresh failed:', error);
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if this path requires authentication
  const needsAuth = requiresAuth(pathname);
  
  if (!needsAuth) {
    // Public path - allow access
    return NextResponse.next();
  }
  
  // Protected path - verify authentication
  const authResult = await verifyAccessToken(request);
  
  if (authResult.isValid) {
    // Token is valid - allow access
    const response = NextResponse.next();
    
    // Add user info to headers for client-side use
    if (authResult.user) {
      response.headers.set('x-user-id', authResult.user.id);
      response.headers.set('x-user-email', authResult.user.email);
    }
    
    return response;
  }
  
  // Token is invalid - try silent refresh
  const refreshSuccess = await attemptSilentRefresh(request);
  
  if (refreshSuccess) {
    // Refresh succeeded - retry verification
    const retryResult = await verifyAccessToken(request);
    
    if (retryResult.isValid) {
      // Allow access after successful refresh
      const response = NextResponse.next();
      
      if (retryResult.user) {
        response.headers.set('x-user-id', retryResult.user.id);
        response.headers.set('x-user-email', retryResult.user.email);
      }
      
      return response;
    }
  }
  
  // Authentication failed - redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  
  return NextResponse.redirect(loginUrl);
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};