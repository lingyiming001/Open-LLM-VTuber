import { Box } from '@chakra-ui/react';
import { useLayoutEffect, useRef } from 'react';
import { create } from 'zustand';
import { sidebarStyles } from './sidebar-styles';

type DockRect = { top: number; left: number; width: number; height: number };
export const useCharacterDock = create<{ rect: DockRect | null }>(() => ({ rect: null }));

/** Uses the original tab preview bounds without remounting the WebGL character. */
export default function CharacterDock() {
  const slot = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const bounds = slot.current?.getBoundingClientRect();
      const rect = bounds && bounds.width > 0 && bounds.height > 0
        ? { top: bounds.top, left: bounds.left, width: bounds.width, height: bounds.height } : null;
      const previous = useCharacterDock.getState().rect;
      if (JSON.stringify(previous) !== JSON.stringify(rect)) useCharacterDock.setState({ rect });
      frame = requestAnimationFrame(measure);
    };
    measure();
    return () => { cancelAnimationFrame(frame); useCharacterDock.setState({ rect: null }); };
  }, []);
  return <Box {...sidebarStyles.browserPanel.container}>
    <Box {...sidebarStyles.browserPanel.header} />
    <Box ref={slot} {...sidebarStyles.browserPanel.browserContainer} aria-label="人物小窗口" />
  </Box>;
}
