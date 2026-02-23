'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';

const PING_INTERVAL = 45_000;
const COUNT_INTERVAL = 30_000;

function getVisitorId(): string {
  let id = sessionStorage.getItem('useai_visitor_id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('useai_visitor_id', id);
  }
  return id;
}

export function usePresence() {
  const [count, setCount] = useState<number | null>(null);

  const ping = useCallback(async () => {
    try {
      const visitorId = getVisitorId();
      await apiFetch('/api/presence/ping', {
        method: 'POST',
        body: JSON.stringify({ visitorId }),
      });
    } catch {
      // silent — presence is best-effort
    }
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ count: number }>('/api/presence/count');
      setCount(data.count);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    ping();
    fetchCount();

    const pingTimer = setInterval(ping, PING_INTERVAL);
    const countTimer = setInterval(fetchCount, COUNT_INTERVAL);

    return () => {
      clearInterval(pingTimer);
      clearInterval(countTimer);
    };
  }, [ping, fetchCount]);

  return { count };
}
