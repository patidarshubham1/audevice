import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AU Device Assignee',
  description: 'Morning testing-device allocation dashboard for React Native teams.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
