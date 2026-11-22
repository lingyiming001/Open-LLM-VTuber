import { create } from 'zustand';
import { ModelInfo } from '@/types/live2d';
import { ConfigFile } from '@/types/websocket';

export type { ConfigFile };

interface SessionSnapshot {
  clientUid: string;
  confName: string;
  confUid: string;
  modelInfo?: ModelInfo;
}

interface SessionState extends SessionSnapshot {
  configFiles: ConfigFile[];
  setModelAndCharacter: (snapshot: Required<SessionSnapshot>) => void;
  setConfName: (confName: string) => void;
  setConfUid: (confUid: string) => void;
  setConfigFiles: (configFiles: ConfigFile[]) => void;
  setModelInfo: (modelInfo?: ModelInfo) => void;
  getFilenameByName: (name: string) => string | undefined;
  reset: () => void;
}

const readPersistedModel = (): ModelInfo | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const model = window.localStorage.getItem('modelInfo');
    return model ? JSON.parse(model) as ModelInfo : undefined;
  } catch {
    return undefined;
  }
};

const persistModel = (modelInfo?: ModelInfo) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('modelInfo', JSON.stringify(modelInfo ? { ...modelInfo, url: '' } : undefined));
};

const initialState = (): SessionSnapshot & Pick<SessionState, 'configFiles'> => ({
  clientUid: '',
  confName: '',
  confUid: '',
  modelInfo: readPersistedModel(),
  configFiles: [],
});

const normaliseModelInfo = (modelInfo?: ModelInfo, previous?: ModelInfo) => {
  if (!modelInfo?.url) return undefined;
  return {
    ...modelInfo,
    kScale: Number(modelInfo.kScale || 0.5) * 2,
    pointerInteractive: modelInfo.pointerInteractive ?? previous?.pointerInteractive ?? true,
    scrollToResize: modelInfo.scrollToResize ?? previous?.scrollToResize ?? true,
  };
};

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState(),
  setModelAndCharacter: (snapshot) => {
    const modelInfo = normaliseModelInfo(snapshot.modelInfo, get().modelInfo);
    persistModel(modelInfo);
    set({ ...snapshot, modelInfo });
  },
  setConfName: (confName) => set({ confName }),
  setConfUid: (confUid) => set({ confUid }),
  setConfigFiles: (configFiles) => set({ configFiles }),
  setModelInfo: (modelInfo) => {
    const nextModelInfo = normaliseModelInfo(modelInfo, get().modelInfo);
    persistModel(nextModelInfo);
    set({ modelInfo: nextModelInfo });
  },
  getFilenameByName: (name) => get().configFiles.find((config) => config.name === name)?.filename,
  reset: () => set(initialState()),
}));
