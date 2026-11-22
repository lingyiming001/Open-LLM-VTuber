import { create } from 'zustand';

type ContentMode = 'normal' | 'reading' | 'video';
type VideoFit = 'contain' | 'cover';
export const useContentModeStore = create<{
  contentMode: ContentMode;
  view: ContentMode;
  readingEnabled: boolean;
  videoEnabled: boolean;
  videoFit: VideoFit;
  setContentMode: (mode: ContentMode) => void;
  setView: (view: ContentMode) => void;
  setEnabled: (mode: 'reading' | 'video', enabled: boolean) => void;
  reset: () => void;
  setVideoFit: (fit: VideoFit) => void;
}>((set) => ({
  contentMode: 'normal', view: 'normal',
  readingEnabled: true, videoEnabled: true,
  videoFit: 'contain',
  setContentMode: (contentMode) => set({ contentMode }),
  setView: (view) => set({ view, contentMode: 'normal' }),
  setEnabled: (mode, enabled) => set(mode === 'reading' ? { readingEnabled: enabled } : { videoEnabled: enabled }),
  reset: () => set({ contentMode: 'normal', view: 'normal' }),
  setVideoFit: (videoFit) => set({ videoFit }),
}));
