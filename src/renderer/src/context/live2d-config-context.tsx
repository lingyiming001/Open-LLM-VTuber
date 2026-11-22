import { ReactNode, useState } from 'react';
import { ModelInfo } from '@/types/live2d';
import { useSessionStore } from '@/stores/session-store';

export type { ModelInfo };

/** Compatibility wrapper while callers migrate to useSessionStore directly. */
export function Live2DConfigProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useLive2DConfig() {
  const modelInfo = useSessionStore((state) => state.modelInfo);
  const setModelInfo = useSessionStore((state) => state.setModelInfo);
  const [isLoading, setIsLoading] = useState(false);
  return { modelInfo, setModelInfo, isLoading, setIsLoading };
}

export default Live2DConfigProvider;
