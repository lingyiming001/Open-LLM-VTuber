/* eslint-disable */
import { Tabs } from '@chakra-ui/react'
import { FiCamera, FiMonitor, FiGlobe, FiMusic, FiFilm } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { sidebarStyles } from './sidebar-styles'
import CameraPanel from './camera-panel'
import ScreenPanel from './screen-panel'
import BrowserPanel from './browser-panel'
import MusicPanel from './music-panel'
import VideoPreview from './video-preview'
import CharacterDock from './character-dock'
import { useContentModeStore } from '@/stores/content-mode-store'
import { useEffect, useState } from 'react'

function BottomTab(): JSX.Element {
  const { t } = useTranslation();
  const { contentMode, readingEnabled, videoEnabled } = useContentModeStore();
  const showCharacter = (contentMode === 'reading' && readingEnabled) || (contentMode === 'video' && videoEnabled);
  const [active, setActive] = useState('camera');
  useEffect(() => {
    const listener = (event: Event) => {
      const { action, kind } = (event as CustomEvent).detail;
      if (action === 'play' && (kind === 'videos' || kind === 'music')) setActive(kind === 'videos' ? 'video' : 'music');
    };
    window.addEventListener('vtuber-stage-action', listener);
    return () => window.removeEventListener('vtuber-stage-action', listener);
  }, []);
  
  return (
    <Tabs.Root 
      value={active} onValueChange={(e) => setActive(e.value)} 
      variant="plain"
      className="vt-media-panel"
      {...sidebarStyles.bottomTab.container}
    >
      <Tabs.List {...sidebarStyles.bottomTab.list} className="vt-media-tabs">
        <Tabs.Trigger value="camera" {...sidebarStyles.bottomTab.trigger}>
          <FiCamera />
          {t('sidebar.camera')}
        </Tabs.Trigger>
        <Tabs.Trigger value="screen" {...sidebarStyles.bottomTab.trigger}>
          <FiMonitor />
          {t('sidebar.screen')}
        </Tabs.Trigger>
        <Tabs.Trigger value="browser" {...sidebarStyles.bottomTab.trigger}>
          <FiGlobe />
          {t('sidebar.browser')}
        </Tabs.Trigger>
        <Tabs.Trigger value="video" {...sidebarStyles.bottomTab.trigger}><FiFilm />视频</Tabs.Trigger>
        <Tabs.Trigger value="music" {...sidebarStyles.bottomTab.trigger}><FiMusic />音乐</Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="camera">
        {showCharacter && active === 'camera' ? <CharacterDock /> : <CameraPanel />}
      </Tabs.Content>
      
      <Tabs.Content value="screen">
        {showCharacter && active === 'screen' ? <CharacterDock /> : <ScreenPanel />}
      </Tabs.Content>
      
      <Tabs.Content value="browser">
        {showCharacter && active === 'browser' ? <CharacterDock /> : <BrowserPanel />}
      </Tabs.Content>
      <Tabs.Content value="video">{showCharacter && active === 'video' ? <CharacterDock /> : <VideoPreview />}</Tabs.Content>
      <Tabs.Content value="music">{showCharacter && active === 'music' ? <CharacterDock /> : <MusicPanel />}</Tabs.Content>
    </Tabs.Root>
  );
}

export default BottomTab
