'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-500 flex items-center justify-center text-white text-xs font-bold">CA</div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Closer Assistant</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">SZI</span>
        </div>
        <nav className="flex gap-1">
          {[
            { href: '/brief', label: 'Pré-Reunião' },
            { href: '/debrief', label: 'Pós-Reunião' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-blue-500/15 text-blue-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
