'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function Nav() {
  const pathname = usePathname();
  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        borderColor: 'var(--border)',
        background: 'rgba(7, 14, 28, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg width="100" height="22" viewBox="0 0 100 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* "sea" text */}
            <text x="0" y="17" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fontSize="17" fontWeight="700" fill="#e8f0ff">sea</text>
            {/* house icon replacing the 'o' */}
            <g transform="translate(38, 2)">
              <rect x="1" y="7" width="14" height="11" rx="1.5" fill="#E8603A"/>
              <path d="M0 8.5L8 1L16 8.5" stroke="#E8603A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <rect x="5.5" y="11" width="5" height="7" rx="1" fill="rgba(7,14,28,0.4)"/>
            </g>
            {/* "zone" text */}
            <text x="57" y="17" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" fontSize="17" fontWeight="700" fill="#e8f0ff">zone</text>
          </svg>
          <div className="h-4 w-px" style={{ background: 'var(--border-bright)' }} />
          <span
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--accent)', letterSpacing: '0.18em' }}
          >
            Closer
          </span>
        </div>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--surface)' }}>
          {[
            { href: '/brief', label: 'Pré-Reunião' },
            { href: '/debrief', label: 'Pós-Reunião' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-4 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all duration-200',
                pathname === href
                  ? 'text-background'
                  : 'hover:text-white'
              )}
              style={
                pathname === href
                  ? { background: 'var(--accent)', color: 'var(--background)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
