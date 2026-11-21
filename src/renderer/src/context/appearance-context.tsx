import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Appearance = { mode: 'dark' | 'light' | 'system'; accent: string };
const defaults: Appearance = { mode: 'dark', accent: '#6366f1' };
export const accents = ['#6366f1', '#2563eb', '#059669', '#d97706', '#db2777'];
function load(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem('vt-appearance') || '{}');
    return { mode: ['dark', 'light', 'system'].includes(saved.mode) ? saved.mode : 'dark', accent: accents.includes(saved.accent) ? saved.accent : defaults.accent };
  } catch { return defaults; }
}
const AppearanceContext = createContext({ appearance: defaults, setAppearance: (_value: Appearance) => {} });
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(load);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const resolved = appearance.mode === 'system' ? (media.matches ? 'dark' : 'light') : appearance.mode;
      document.documentElement.dataset.vtTheme = resolved;
      document.documentElement.style.setProperty('--vt-accent', appearance.accent);
      document.documentElement.style.colorScheme = resolved;
    };
    apply();
    localStorage.setItem('vt-appearance', JSON.stringify(appearance));
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);
  return <AppearanceContext.Provider value={{ appearance, setAppearance }}>{children}</AppearanceContext.Provider>;
}
export const useAppearance = () => useContext(AppearanceContext);
