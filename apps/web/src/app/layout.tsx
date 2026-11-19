import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'Multi-Vendor E-Commerce Platform | BTL DBMS HK261 (MS SQL Server)',
  description:
    'Next.js App Router + NestJS Modular Backend connected to single DBMS Microsoft SQL Server (ECommerceDB)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
