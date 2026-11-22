import { create } from 'zustand';

export type AiState = 'idle' | 'thinking-speaking' | 'interrupted' | 'loading' | 'listening' | 'waiting';

interface RuntimeState {
  aiState: AiState;
  backendSynthComplete: boolean;
  subtitleText: string;
  showSubtitle: boolean;
  setAiState: (state: AiState | ((currentState: AiState) => AiState)) => void;
  setBackendSynthComplete: (backendSynthComplete: boolean) => void;
  setSubtitleText: (subtitleText: string) => void;
  setShowSubtitle: (showSubtitle: boolean) => void;
  reset: () => void;
}

const DEFAULT_SUBTITLE = "Hi, I'm some random AI VTuber. Who the hell are ya? Ahh, you must be amazed by my awesomeness, right? right?";
let waitingTimer: ReturnType<typeof setTimeout> | undefined;

const initialState = () => ({
  aiState: 'loading' as AiState,
  backendSynthComplete: false,
  subtitleText: DEFAULT_SUBTITLE,
  showSubtitle: true,
});

const clearWaitingTimer = () => {
  if (waitingTimer) clearTimeout(waitingTimer);
  waitingTimer = undefined;
};

export const useRuntimeStore = create<RuntimeState>((set, get) => ({
  ...initialState(),
  setAiState: (state) => {
    const currentState = get().aiState;
    const nextState = typeof state === 'function' ? state(currentState) : state;
    if (nextState === 'waiting' && currentState === 'thinking-speaking') return;

    clearWaitingTimer();
    set({ aiState: nextState });
    if (nextState === 'waiting') {
      waitingTimer = setTimeout(() => {
        set({ aiState: 'idle' });
        waitingTimer = undefined;
      }, 2_000);
    }
  },
  setBackendSynthComplete: (backendSynthComplete) => set({ backendSynthComplete }),
  setSubtitleText: (subtitleText) => set({ subtitleText }),
  setShowSubtitle: (showSubtitle) => set({ showSubtitle }),
  reset: () => {
    clearWaitingTimer();
    set(initialState());
  },
}));
