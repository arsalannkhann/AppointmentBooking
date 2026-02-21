'use client';

import { useEffect, useState } from 'react';
import type { PageId } from '@/app/page';
import { api } from '@/lib/api-client';
import type { AppointmentStats } from '@/types';

interface Props {
  activePage: PageId;
  onNavigate: (p: PageId) => void;
}

const NAV = [
  { id: 'chat' as PageId, icon: '💬', label: 'Book Appointment' },
  { id: 'calendar' as PageId, icon: '📅', label: 'Calendar' },
  { id: 'doctors' as PageId, icon: '👨‍⚕️', label: 'Doctors & Clinics' },
  { id: 'admin' as PageId, icon: '🗄', label: 'Admin / Data' },
];

export default function Sidebar({ activePage, onNavigate }: Props) {
  const [stats, setStats] = useState<AppointmentStats | null>(null);

  useEffect(() => {
    api.appointments.stats().then(setStats).catch(() => null);
  }, []);

  return (
    <aside
      style={{ background: 'var(--card)' }}
      className="w-full md:w-60 flex-shrink-0 flex flex-col h-auto md:h-full border-b md:border-b-0 md:border-r border-[var(--border)] z-20 shadow-sm md:shadow-none"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2 md:gap-3">
          <span style={{ color: 'var(--primary)', fontSize: 22 }}>⚕</span>
          <div>
            <div
              className="font-serif font-semibold leading-tight"
              style={{ color: 'var(--primary)', fontSize: 17, letterSpacing: -0.3 }}
            >
              MedDent
            </div>
            <div className="hidden md:block leading-tight" style={{ color: 'var(--text3)', fontSize: 11 }}>Booking System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-1 p-2 md:p-3 flex-shrink-0 no-scrollbar">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item whitespace-nowrap flex-1 md:w-full justify-center md:justify-start ${activePage === item.id ? 'active' : ''}`}
          >
            <span>{item.icon}</span>
            <span className="text-xs md:text-[13.5px]">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Stats */}
      {stats && (
        <div className="hidden md:flex p-4 flex-col gap-3 border-t border-[var(--border)] mt-auto">
          <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'var(--font-mono)' }}>
            Live Stats
          </div>
          {[
            { label: 'Today', value: stats.today },
            { label: 'This Week', value: stats.this_week },
            { label: 'Total', value: stats.total },
          ].map(s => (
            <div key={s.label} className="flex justify-between items-center">
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s.label}</span>
              <span
                style={{
                  background: 'var(--primary-dim)',
                  color: 'var(--primary)',
                  border: '1px solid rgba(13,148,136,0.2)',
                  borderRadius: 6,
                  padding: '1px 8px',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Version */}
      <div
        className="hidden md:block px-4 py-3"
        style={{ borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}
      >
        v2.0.0 · Cloud Run + Cloud SQL
      </div>
    </aside>
  );
}
