import { ReactNode } from 'react';
import { useRuntimeStore } from '@/stores/runtime-store';

/** Compatibility wrapper while callers migrate to useRuntimeStore directly. */
export function SubtitleProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useSubtitle() {
  const state = useRuntimeStore();
  return {
    subtitleText: state.subtitleText,
    setSubtitleText: state.setSubtitleText,
    showSubtitle: state.showSubtitle,
    setShowSubtitle: state.setShowSubtitle,
  };
}
