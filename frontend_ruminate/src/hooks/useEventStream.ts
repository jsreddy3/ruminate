import { useState, useEffect, useRef, useCallback } from 'react';

export function useEventStream(
  connectFn: () => EventSource | null
) {
  const [isConnected, setIsConnected] = useState(false);
  const [currentEvents, setCurrentEvents] = useState<any[]>([]);
  const [eventsMap, setEventsMap] = useState<Map<string, any[]>>(new Map());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = connectFn();
    if (!es) return;

    es.onopen = () => setIsConnected(true);
    es.onerror = (error) => {
      setIsConnected(false);
      // Close on error to prevent auto-reconnect spam
      try { es.close(); } catch {};
    };
    es.onmessage = (e: MessageEvent) => {
      let data: any;
      try { data = JSON.parse(e.data); }
      catch { data = e.data; }

      const key = (data.message_id || data.conversation_id || 'default').toString();

      // 1. append to flat list
      setCurrentEvents(prev => [...prev, data]);
      // 2. append to per-key map
      setEventsMap(prevMap => {
        const map = new Map(prevMap);
        const arr = map.get(key) || [];
        map.set(key, [...arr, data]);
        return map;
      });
    };

    esRef.current = es;
    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [connectFn]);

  const resetEvents = useCallback((key?: string) => {
    setCurrentEvents([]);
    if (key) {
      setEventsMap(prev => {
        const map = new Map(prev);
        map.delete(key);
        return map;
      });
    } else {
      setEventsMap(new Map());
    }
  }, []);

  return { isConnected, currentEvents, eventsMap, resetEvents };
}
