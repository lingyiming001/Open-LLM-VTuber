import { ReactNode } from 'react';
import { AiState, useRuntimeStore } from '@/stores/runtime-store';

export const enum AiStateEnum {
  IDLE = 'idle',
  THINKING_SPEAKING = 'thinking-speaking',
  INTERRUPTED = 'interrupted',
  LOADING = 'loading',
  LISTENING = 'listening',
  WAITING = 'waiting',
}

export type { AiState };

/** Compatibility wrapper while callers migrate to useRuntimeStore directly. */
export function AiStateProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useAiState() {
  const state = useRuntimeStore();
  return {
    aiState: state.aiState,
    setAiState: state.setAiState,
    backendSynthComplete: state.backendSynthComplete,
    setBackendSynthComplete: state.setBackendSynthComplete,
    isIdle: state.aiState === AiStateEnum.IDLE,
    isThinkingSpeaking: state.aiState === AiStateEnum.THINKING_SPEAKING,
    isInterrupted: state.aiState === AiStateEnum.INTERRUPTED,
    isLoading: state.aiState === AiStateEnum.LOADING,
    isListening: state.aiState === AiStateEnum.LISTENING,
    isWaiting: state.aiState === AiStateEnum.WAITING,
    resetState: () => state.setAiState(AiStateEnum.IDLE),
  };
}
