import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/providers';

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sans',
});

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
    <html lang="vi" className={montserrat.variable}>
      <body className="min-h-screen bg-surface-app text-body font-sans antialiased selection:bg-primary selection:text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

