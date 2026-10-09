import type { Metadata, Viewport } from 'next';
import { Oswald, Inter } from 'next/font/google';
import './globals.css';
import RegisterSW from '@/components/RegisterSW';

const display = Oswald({ weight: ['500', '600', '700'], subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'Naija Biro Fight',
  description: 'Break-time biro fight, as it was played on the last bench. Realistic 3D, real physics, invite your friend.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  applicationName: 'Naija Biro Fight',
  appleWebApp: { capable: true, title: 'Biro Fight', statusBarStyle: 'black-translucent' },
  openGraph: { title: 'Naija Biro Fight', description: 'Two biros. One desk. Send your friend the link.', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#0d1411', width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false };

export default function RootLayout({ children }: { children: import('react').ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
