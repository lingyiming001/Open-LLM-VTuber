import { create } from 'zustand';
export const useMediaPlaybackStore = create<{ kind: 'music' | 'videos' | null; setKind: (kind: 'music' | 'videos' | null) => void }>((set) => ({ kind: null, setKind: (kind) => set({ kind }) }));
