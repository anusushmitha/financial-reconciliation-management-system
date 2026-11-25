import React, { createContext, useContext, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

interface RealtimeContextType {
  isConnected: boolean;
  connectionState: string;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  connectionState: 'Disconnected',
});

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('Disconnected');
  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const hubUrl = 'http://localhost:5000/hubs/lendguard';

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (payload: any) => {
      // Determine toast type
      let type: 'success' | 'warning' | 'info' | 'error' = 'info';
      if (payload.eventType === 'EXCEPTION_RESOLVED' || payload.eventType === 'BATCH_ASSIGNED' || payload.eventType === 'SYSTEM_RESEEDED') {
        type = 'success';
      } else if (payload.eventType === 'ANOMALY_FLAGGED' || payload.eventType === 'CRITICAL_OUTLIER') {
        type = 'warning';
      }

      showToast(payload.title || 'Platform Notification', payload.message || '', type);

      // Broadcast globally to allow page-level auto-refresh
      window.dispatchEvent(new CustomEvent('lendguard:realtime', { detail: payload }));
    });

    const startConnection = async () => {
      try {
        await connection.start();
        setIsConnected(true);
        setConnectionState('Connected');

        if (user?.id) {
          try {
            await connection.invoke('JoinRoom', `user_${user.id}`);
          } catch {}
        }
      } catch (err) {
        setIsConnected(false);
        setConnectionState('Reconnecting');
      }
    };

    startConnection();

    connection.onreconnecting(() => {
      setIsConnected(false);
      setConnectionState('Reconnecting');
    });

    connection.onreconnected(async () => {
      setIsConnected(true);
      setConnectionState('Connected');
      if (user?.id) {
        try {
          await connection.invoke('JoinRoom', `user_${user.id}`);
        } catch {}
      }
    });

    connection.onclose(() => {
      setIsConnected(false);
      setConnectionState('Disconnected');
    });

    return () => {
      connection.stop();
    };
  }, [user?.id, showToast]);

  return (
    <RealtimeContext.Provider value={{ isConnected, connectionState }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
