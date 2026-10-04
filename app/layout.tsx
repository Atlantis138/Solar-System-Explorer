import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Solar System Explorer',
  description: 'An interactive 2D/2.5D solar system exploration experience.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <script src="https://cdn.tailwindcss.com" />
        <script src="https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
