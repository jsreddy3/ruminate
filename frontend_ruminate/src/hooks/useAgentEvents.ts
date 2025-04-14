// src/hooks/useAgentEvents.ts
import { useState, useEffect } from 'react';
import { AgentEvent, AgentEventType, connectToAgentEvents } from '../services/rabbithole';

export function useAgentEvents(conversationId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'exploring' | 'completed' | 'error'>('idle');
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    if (!conversationId) return;
    
    // Connect to SSE
    const eventSource = connectToAgentEvents(conversationId);
    let mounted = true;
    
    // Event handlers
    const handlers: Record<AgentEventType | 'connected' | 'ping', (data: any) => void> = {
      connected: () => {
        if (mounted) setIsConnected(true);
      },
      agent_started: () => {
        if (mounted) setStatus('exploring');
      },
      agent_action: (data) => {
        if (mounted) {
          setEvents(prev => [...prev, {
            ...data,
            timestamp: Date.now(),
            type: 'agent_action'
          }]);
        }
      },
      agent_answer: (data) => {
        if (mounted) {
          setEvents(prev => [...prev, {
            ...data,
            timestamp: Date.now(),
            type: 'agent_answer'
          }]);
        }
      },
      agent_completed: () => {
        if (mounted) setStatus('completed');
      },
      agent_error: () => {
        if (mounted) setStatus('error');
      },
      agent_timeout: () => {
        if (mounted) setStatus('error');
      },
      ping: () => {
        // Keep-alive ping, no action needed
      }
    };
    
    // Register event listeners
    Object.entries(handlers).forEach(([event, handler]) => {
      eventSource.addEventListener(event, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handler(data);
        } catch (error) {
          console.error(`Error parsing ${event} event:`, error);
        }
      });
    });
    
    // Handle connection errors
    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (mounted) setStatus('error');
    };
    
    // Cleanup
    return () => {
      mounted = false;
      eventSource.close();
      setEvents([]);
      setStatus('idle');
      setIsConnected(false);
    };
  }, [conversationId]);
  
  return { events, status, isConnected };
}