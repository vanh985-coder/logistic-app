import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/providers';

export const metadata: Metadata = {
  title: 'LOGIX-3D — Nền Tảng Ghép Hàng LCL & Tối Ưu Container 3D',
  description: 'Nền tảng SaaS gom hàng lẻ LCL/LTL thông minh với lõi tối ưu xếp container 3D',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-blue-600 selection:text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
