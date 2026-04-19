import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { cookies } from "next/headers";

const inter = Inter({ subsets: ["latin"] });

const API_BASE_URL = process.env.INTERNAL_API_URL || 'http://backend:4000';

async function getUser() {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return data.user ?? null;
    }
  } catch {}
  return null;
}

export const metadata: Metadata = {
  title: "Afeka Trip Planner 2026",
  description: "Plan your hiking and cycling trips with AI-generated routes, weather forecasts, and interactive maps",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`} suppressHydrationWarning={true}>
        <Navigation initialUser={user} />
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="bg-gray-800 text-white py-6 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p>Afeka Trip Planner 2026 - Final Project</p>
            <p className="text-sm text-gray-400 mt-2">Web Development Course</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
