import { create } from 'zustand';

export type WebSocketState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

export const DEFAULT_WS_URL = 'ws://127.0.0.1:12393/client-ws';
export const DEFAULT_BASE_URL = 'http://127.0.0.1:12393';

interface ConnectionState {
  wsUrl: string;
  baseUrl: string;
  wsState: WebSocketState;
  setWsUrl: (wsUrl: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  setEndpoints: (wsUrl: string, baseUrl: string) => void;
  setWsState: (wsState: WebSocketState) => void;
  reset: () => void;
}

const persisted = (key: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'string' ? parsed : fallback;
    } catch {
      return value;
    }
  } catch {
    return fallback;
  }
};

const persist = (key: string, value: string) => {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Endpoint changes still work when browser storage is unavailable.
  }
};

const initialState = () => ({
  wsUrl: persisted('wsUrl', DEFAULT_WS_URL),
  baseUrl: persisted('baseUrl', DEFAULT_BASE_URL),
  wsState: 'CLOSED' as WebSocketState,
});

export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initialState(),
  setWsUrl: (wsUrl) => {
    persist('wsUrl', wsUrl);
    set({ wsUrl });
  },
  setBaseUrl: (baseUrl) => {
    persist('baseUrl', baseUrl);
    set({ baseUrl });
  },
  setEndpoints: (wsUrl, baseUrl) => {
    persist('wsUrl', wsUrl);
    persist('baseUrl', baseUrl);
    set({ wsUrl, baseUrl });
  },
  setWsState: (wsState) => set({ wsState }),
  reset: () => set(initialState()),
}));
