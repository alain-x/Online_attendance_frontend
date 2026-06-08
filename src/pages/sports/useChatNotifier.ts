import { useCallback, useEffect, useRef, useState } from 'react';
import { listChatRooms } from '../../api/sports';
import type { ChatRoom } from '../../api/types';

const POLL_INTERVAL = 10000;

export function useChatNotifier() {
  const [totalUnread, setTotalUnread] = useState(0);
  const prevRoomsRef = useRef<ChatRoom[]>([]);
  const seenTimestamps = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const r = await listChatRooms();
      const prevRooms = prevRoomsRef.current;

      if (prevRooms.length > 0) {
        let unreadDelta = 0;
        for (const room of r) {
          if (room.lastMessageAt) {
            const seen = seenTimestamps.current.get(room.id);
            if (seen && room.lastMessageAt > seen) {
              unreadDelta++;
              const oldRoom = prevRooms.find(ro => ro.id === room.id);
              if (oldRoom?.lastMessageContent !== room.lastMessageContent) {
                const body = room.lastMessageSenderName
                  ? `${room.lastMessageSenderName}: ${room.lastMessageContent || ''}`
                  : (room.lastMessageContent || 'New message');
                sendBrowserNotification(room.name, body);
              }
            }
            seenTimestamps.current.set(room.id, room.lastMessageAt);
          }
        }
        if (unreadDelta > 0) {
          setTotalUnread(prev => prev + unreadDelta);
        }
      } else {
        for (const room of r) {
          if (room.lastMessageAt) {
            seenTimestamps.current.set(room.id, room.lastMessageAt);
          }
        }
      }
      prevRoomsRef.current = r;
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [poll]);

  function clearUnread() {
    setTotalUnread(0);
  }

  return { totalUnread, clearUnread };
}

function sendBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico' });
    } catch {
      // silent
    }
  }
}
