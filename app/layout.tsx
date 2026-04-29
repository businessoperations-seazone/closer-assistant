import type { Metadata } from 'next';
import './globals.css';
import Nav from './Nav';

export const metadata: Metadata = {
  title: 'Closer Assistant — Seazone',
  description: 'Agente de inteligência comercial para closers SZI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
        <Nav />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
