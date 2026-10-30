import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Release room — FE Timeline',
  description: 'Timeline กลางของทีม Frontend สำหรับ App และ Web จาก Google Sheets',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
