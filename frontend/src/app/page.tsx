'use client';

import { useState } from 'react';
import Sidebar from '@/components/ui/Sidebar';
import ChatPage from '@/components/chat/ChatPage';
import CalendarPage from '@/components/calendar/CalendarPage';
import DoctorsPage from '@/components/doctors/DoctorsPage';
import AdminPage from '@/components/admin/AdminPage';

export type PageId = 'chat' | 'calendar' | 'doctors' | 'admin';

export default function Home() {
  const [activePage, setActivePage] = useState<PageId>('chat');
  const [refreshKey, setRefreshKey] = useState(0);

  function onBookingConfirmed() {
    setRefreshKey(k => k + 1);
    setActivePage('calendar');
  }

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] overflow-hidden">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="flex-1 overflow-hidden">
        {activePage === 'chat' && (
          <ChatPage onBookingConfirmed={onBookingConfirmed} />
        )}
        {activePage === 'calendar' && (
          <CalendarPage key={refreshKey} />
        )}
        {activePage === 'doctors' && <DoctorsPage />}
        {activePage === 'admin' && <AdminPage />}
      </main>
    </div>
  );
}
