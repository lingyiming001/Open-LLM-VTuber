import { Box, Text } from '@chakra-ui/react';
import { useContentModeStore } from '@/stores/content-mode-store';
import { Switch } from '@/components/ui/switch';
import { useSubtitle } from '@/context/subtitle-context';

export default function ContentModeSettings() {
  const { readingEnabled, videoEnabled, setEnabled, videoFit, setVideoFit } = useContentModeStore();
  const { showSubtitle, setShowSubtitle } = useSubtitle();
  return <Box display="flex" flexDirection="column" gap={5}>
    <Text fontWeight="bold">阅读与视频</Text>
    <Text fontSize="sm" color="var(--vt-muted)">开启后仅在播放时缩小人物，正常聊天自动恢复普通布局。</Text>
    <Switch checked={readingEnabled} onCheckedChange={(e) => setEnabled('reading', e.checked)}>阅读模式</Switch>
    <Switch checked={videoEnabled} onCheckedChange={(e) => setEnabled('video', e.checked)}>视频模式</Switch>
    <label><input type="checkbox" checked={!showSubtitle} onChange={(e) => setShowSubtitle(!e.target.checked)} /> 隐藏底部字幕</label>
    <label>视频画面 <select aria-label="视频画面适配" value={videoFit} onChange={(e) => setVideoFit(e.target.value as 'contain' | 'cover')}><option value="contain">完整显示</option><option value="cover">铺满裁切</option></select></label>
  </Box>;
}
