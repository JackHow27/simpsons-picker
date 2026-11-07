import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simpsons Picker",
  description: "Pick a Simpsons character and save your selection.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            <span className="brand-donut" aria-hidden>
              ◉
            </span>
            Simpsons Picker
          </Link>
          <nav className="nav">
            {user ? (
              <>
                {user.role === "admin" && (
                  <Link href="/admin" className="nav-link">
                    Admin
                  </Link>
                )}
                <span className="nav-user">
                  Signed in as <strong>{user.displayName}</strong>
                </span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link href="/login" className="nav-link">
                  Log in
                </Link>
                <Link href="/register" className="btn btn-primary btn-sm">
                  Sign up
                </Link>
              </>
            )}
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
