'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { authService, User } from '@/lib/auth';

export default function Navigation({ initialUser }: { initialUser?: User | null }) {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(initialUser ?? null);
  const [loading, setLoading] = useState(initialUser === undefined);

  // Sync state when server re-renders with new initialUser (e.g., after login/logout + router.refresh())
  useEffect(() => {
    if (initialUser !== undefined) {
      setUser(initialUser ?? null);
      setLoading(false);
    }
  }, [initialUser]);

  // Only do client-side auth check if server didn't provide user info
  useEffect(() => {
    if (initialUser === undefined) {
      checkAuth();
    }
  }, []);

  const checkAuth = async () => {
    setLoading(true);
    const { isAuthenticated, user } = await authService.checkAuth();
    setUser(user);
    setLoading(false);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    window.location.href = '/';
  };

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/planning', label: 'Planning' },
    { href: '/history', label: 'History' },
  ];

  const authLinks = [
    { href: '/login', label: 'Login' },
    { href: '/register', label: 'Register' },
  ];

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Afeka Trip Planner 2026
            </Link>
            
            <div className="hidden md:flex space-x-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="text-gray-500 text-sm">Loading...</div>
            ) : user ? (
              <>
                <div className="hidden md:block text-sm text-gray-700">
                  Welcome, <span className="font-semibold">{user.firstName || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                {authLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      pathname === link.href
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}