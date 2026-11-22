import { useConnectionStore } from '@/stores/connection-store';
import { useRuntimeStore } from '@/stores/runtime-store';
import { useSessionStore } from '@/stores/session-store';
import { WebSocketMessage } from '@/types/websocket';

const normaliseModelUrl = (url: string, baseUrl: string) => (
  /^https?:\/\//.test(url) ? url : new URL(url, `${baseUrl}/`).toString()
);

/** Applies pure state changes from a backend event. External effects stay in WebSocketHandler. */
export const applyWebSocketStoreUpdate = (message: WebSocketMessage): boolean => {
  switch (message.type) {
    case 'set-model-and-conf': {
      if (!message.model_info || !message.conf_name || !message.conf_uid) return false;
      const baseUrl = useConnectionStore.getState().baseUrl;
      const clientUid = message.client_uid || useSessionStore.getState().clientUid;
      useSessionStore.getState().setModelAndCharacter({
        clientUid,
        confName: message.conf_name,
        confUid: message.conf_uid,
        modelInfo: {
          ...message.model_info,
          url: normaliseModelUrl(message.model_info.url, baseUrl),
        },
      });
      return true;
    }
    case 'full-text':
      if (!message.text) return false;
      useRuntimeStore.getState().setSubtitleText(message.text);
      return true;
    case 'backend-synth-complete':
      useRuntimeStore.getState().setBackendSynthComplete(true);
      return true;
    default:
      return false;
  }
};
