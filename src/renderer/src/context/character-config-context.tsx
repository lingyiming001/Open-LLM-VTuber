import { ReactNode, useEffect } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { ConfigFile } from '@/types/websocket';

export type { ConfigFile };

/** Compatibility wrapper while callers migrate to useSessionStore directly. */
export function CharacterConfigProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useConfig() {
  const state = useSessionStore();
  useEffect(() => {
    (window.api as any)?.updateConfigFiles?.(state.configFiles);
  }, [state.configFiles]);
  return {
    confName: state.confName,
    confUid: state.confUid,
    configFiles: state.configFiles,
    setConfName: state.setConfName,
    setConfUid: state.setConfUid,
    setConfigFiles: state.setConfigFiles,
    getFilenameByName: state.getFilenameByName,
  };
}
