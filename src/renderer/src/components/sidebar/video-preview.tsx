import { Box, Text } from '@chakra-ui/react';
import { FiFilm, FiPlay } from 'react-icons/fi';
import { useContentModeStore } from '@/stores/content-mode-store';
import { sidebarStyles } from './sidebar-styles';

export default function VideoPreview() {
  const { contentMode } = useContentModeStore();
  const playing = contentMode === 'video';
  return <Box {...sidebarStyles.cameraPanel.container}>
    <Box {...sidebarStyles.cameraPanel.header} />
    <Box
      as="button"
      aria-label={playing ? '正在播放视频，点击选择视频' : '选择视频'}
      {...sidebarStyles.cameraPanel.videoContainer}
          className="vt-media-preview"
      flexDirection="column"
      gap={3}
      color="var(--vt-muted)"
      cursor="pointer"
      _hover={{ bg: 'whiteAlpha.100' }}
      onClick={() => window.dispatchEvent(new Event('vt-open-resource-videos'))}
    >
      {playing ? <FiPlay size={28} /> : <FiFilm size={28} />}
      <Text fontSize="sm">{playing ? '正在主窗口播放视频' : '暂无播放中的视频'}</Text>
      <Text fontSize="xs">点击从资源库选择视频</Text>
    </Box>
  </Box>;
}
