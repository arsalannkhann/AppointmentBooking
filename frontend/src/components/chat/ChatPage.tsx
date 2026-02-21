'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/api-client';
import type { ChatMessage, BookingRequest, Appointment } from '@/types';
import BookingConfirmCard from './BookingConfirmCard';

interface Props {
  onBookingConfirmed: () => void;
}

function parseBookingRequest(text: string): BookingRequest | null {
  const match = text.match(/\[BOOKING_REQUEST\]([\s\S]*?)\[\/BOOKING_REQUEST\]/);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()); } catch { return null; }
}

function stripBooking(text: string): string {
  return text.replace(/\[BOOKING_REQUEST\][\s\S]*?\[\/BOOKING_REQUEST\]/, '').trim();
}

function renderAiText(text: string) {
  return text
    .split('\n')
    .map((line, i) => {
      const processed = line
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text)">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em style="color:var(--amber)">$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:var(--card2);padding:1px 5px;border-radius:4px;font-family:var(--font-mono);font-size:11px;color:var(--primary);border:1px solid var(--border)">$1</code>');
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return `<li key=${i} style="margin-left:16px">${processed.slice(2)}</li>`;
      }
      return `<span key=${i}>${processed}</span>`;
    })
    .join('<br/>');
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-start">
      <Avatar role="assistant" />
      <div className="chat-bubble-ai px-4 py-3">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="typing-dot rounded-full"
              style={{ width: 6, height: 6, background: 'var(--primary)', animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Avatar({ role }: { role: 'user' | 'assistant' }) {
  const isAI = role === 'assistant';
  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
      style={{
        width: 32, height: 32,
        background: isAI ? 'var(--primary-dim)' : 'var(--card2)',
        border: `1px solid ${isAI ? 'rgba(13,148,136,0.3)' : 'var(--border)'}`,
        color: isAI ? 'var(--primary)' : 'var(--text2)',
        fontFamily: 'var(--font-mono)',
        boxShadow: isAI ? '0 2px 8px -2px rgba(13,148,136,0.1)' : 'none',
      }}
    >
      {isAI ? 'AI' : 'PT'}
    </div>
  );
}

function MessageBubble({
  msg,
  onConfirm,
  onReject,
}: {
  msg: ChatMessage;
  onConfirm: (booking: BookingRequest, msgId: string) => Promise<void>;
  onReject: (msgId: string) => void;
}) {
  const isAI = msg.role === 'assistant';
  const displayText = isAI ? stripBooking(msg.content) : msg.content;
  const bookingReq = isAI ? parseBookingRequest(msg.content) : null;

  return (
    <div className={`flex gap-3 items-start ${isAI ? '' : 'flex-row-reverse'}`}>
      <Avatar role={msg.role} />
      <div className="flex-1 min-w-0" style={{ maxWidth: 'calc(100% - 50px)' }}>
        {/* Role label */}
        <div
          className="text-xs mb-1"
          style={{
            color: isAI ? 'var(--text2)' : 'var(--text3)',
            fontFamily: 'var(--font-mono)',
            textAlign: isAI ? 'left' : 'right',
          }}
        >
          {isAI ? 'ARIA — Booking Assistant' : 'Patient'}
        </div>

        {/* Bubble */}
        {displayText && (
          <div
            className={`px-4 py-3 text-sm leading-relaxed ${isAI ? 'chat-bubble-ai' : 'chat-bubble-user'}`}
            dangerouslySetInnerHTML={{ __html: renderAiText(displayText) }}
          />
        )}

        {/* Booking confirm */}
        {bookingReq && !msg.confirmed && !msg.rejected && (
          <BookingConfirmCard
            booking={bookingReq}
            onConfirm={(b) => onConfirm(b, msg.id)}
            onReject={() => onReject(msg.id)}
          />
        )}

        {msg.confirmed && (
          <div
            className="mt-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: 'var(--green)' }}
          >
            ✓ Appointment booked — check the Calendar!
          </div>
        )}
        {msg.rejected && (
          <div
            className="mt-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: '#FF6B6B80' }}
          >
            ✕ Booking cancelled
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage({ onBookingConfirmed }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => uuidv4());
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial greeting
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const resp = await api.chat.send({
          session_id: sessionId,
          messages: [{ role: 'user', content: 'Hello' }],
        });
        setMessages([{
          id: uuidv4(),
          role: 'assistant',
          content: resp.content,
          timestamp: new Date().toISOString(),
        }]);
      } catch {
        setMessages([{
          id: uuidv4(),
          role: 'assistant',
          content: "Hello! I'm **ARIA**, your dental booking assistant. What brings you in today?",
          timestamp: new Date().toISOString(),
        }]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.role === 'assistant' ? stripBooking(m.content) : m.content,
      }));
      const resp = await api.chat.send({ session_id: sessionId, messages: apiMessages });
      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant', content: resp.content, timestamp: new Date().toISOString(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant',
        content: 'Connection error — please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sessionId]);

  const confirmBooking = useCallback(async (booking: BookingRequest, msgId: string) => {
    try {
      await api.chat.confirmBooking(booking, sessionId);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmed: true } : m));
      onBookingConfirmed();
    } catch (err) {
      alert('Failed to book appointment. Please try again.');
    }
  }, [sessionId, onBookingConfirmed]);

  const rejectBooking = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, rejected: true } : m));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-4 md:px-6 py-4 flex-shrink-0"
        style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="font-serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
          💬 Book an Appointment
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>
          Tell ARIA your symptoms — get matched with the right specialist instantly
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 flex flex-col gap-4 no-scrollbar">
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onConfirm={confirmBooking}
            onReject={rejectBooking}
          />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 md:px-6 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex gap-3 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none transition-border"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border2)',
              color: 'var(--text)',
              minHeight: 44,
              maxHeight: 120,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.5,
            }}
            placeholder="Describe your dental problem... (Enter to send, Shift+Enter for newline)"
            value={input}
            rows={1}
            onChange={e => {
              setInput(e.target.value);
              // Auto-grow
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border2)')}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center rounded-xl text-lg font-bold flex-shrink-0 transition-all"
            style={{
              width: 48, height: 48,
              background: loading || !input.trim() ? 'var(--border2)' : 'var(--primary)',
              color: loading || !input.trim() ? 'var(--text3)' : 'white',
              border: 'none',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              boxShadow: loading || !input.trim() ? 'none' : '0 4px 12px -2px rgba(13, 148, 136, 0.3)',
            }}
          >
            ↑
          </button>
        </div>
        <p className="mt-2 text-center" style={{ fontSize: 11, color: 'var(--text3)' }}>
          Session: <span style={{ fontFamily: 'var(--font-mono)' }}>{sessionId.slice(0, 8)}…</span>
        </p>
      </div>
    </div>
  );
}
