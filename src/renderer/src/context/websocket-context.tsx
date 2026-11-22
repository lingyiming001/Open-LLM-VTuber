import { ReactNode, useCallback } from 'react';
import { wsService } from '@/services/websocket-service';
import {
  DEFAULT_BASE_URL,
  DEFAULT_WS_URL,
  useConnectionStore,
} from '@/stores/connection-store';
import { HistoryInfo } from '@/types/websocket';

export type { HistoryInfo };

export const defaultWsUrl = DEFAULT_WS_URL;
export const defaultBaseUrl = DEFAULT_BASE_URL;

/** Compatibility wrapper while callers migrate to useConnectionStore directly. */
export function WebSocketProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useWebSocket() {
  const wsUrl = useConnectionStore((state) => state.wsUrl);
  const baseUrl = useConnectionStore((state) => state.baseUrl);
  const wsState = useConnectionStore((state) => state.wsState);
  const setWsUrlInStore = useConnectionStore((state) => state.setWsUrl);
  const setBaseUrl = useConnectionStore((state) => state.setBaseUrl);
  const setWsUrl = useCallback((url: string) => {
    setWsUrlInStore(url);
    wsService.connect(url);
  }, [setWsUrlInStore]);
  return {
    sendMessage: wsService.sendMessage.bind(wsService),
    wsState,
    reconnect: () => wsService.connect(wsUrl),
    wsUrl,
    setWsUrl,
    baseUrl,
    setBaseUrl,
  };
}
