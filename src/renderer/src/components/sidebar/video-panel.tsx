import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Text } from '@chakra-ui/react';
import { FiFilm, FiRefreshCw } from 'react-icons/fi';
import { useWebSocket } from '@/context/websocket-context';

type Video = { title: string; path: string };
export default function VideoPanel() {
  const { baseUrl } = useWebSocket();
  const [videos, setVideos] = useState<Video[]>([]);
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/media/library`);
      if (!response.ok) throw new Error('无法加载视频列表');
      setVideos((await response.json()).videos); setError('');
    } catch { setError('无法加载视频列表，请重试'); }
  }, [baseUrl]);
  useEffect(() => {
    void refresh(); const listener = () => { void refresh(); };
    window.addEventListener('vt-resources-changed', listener);
    return () => window.removeEventListener('vt-resources-changed', listener);
  }, [refresh]);
  useEffect(() => {
    if (path) void video.current?.play().catch(() => setError('请点击播放器的播放按钮开始播放'));
  }, [path]);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.kind && detail.kind !== 'videos') return;
      if (detail.action === 'play' && detail.path) { setError(''); setPath(detail.path); }
      if (detail.action === 'pause') video.current?.pause();
      if (detail.action === 'resume' && path) void video.current?.play().catch(() => setError('请点击播放按钮继续播放'));
      if (detail.action === 'stop') { video.current?.pause(); setPath(''); }
    };
    const stop = () => video.current?.pause();
    window.addEventListener('vtuber-stage-action', listener); window.addEventListener('vtuber-emergency-stop', stop);
    return () => { window.removeEventListener('vtuber-stage-action', listener); window.removeEventListener('vtuber-emergency-stop', stop); };
  }, [path]);
  return <Box px={4} color="var(--vt-text)">
    {path ? <video ref={video} src={`${baseUrl.replace(/\/$/, '')}/api/media/file/videos/${path.split('/').map(encodeURIComponent).join('/')}`} controls playsInline onError={() => setError('视频加载失败或格式不受支持')} style={{ width: '100%', height: 240, background: '#09090b', borderRadius: 10 }} /> : <Box height="240px" bg="var(--vt-raised)" borderRadius="lg" display="flex" alignItems="center" justifyContent="center" flexDirection="column" gap={3} color="var(--vt-muted)"><FiFilm size={28} /><Text fontSize="sm">暂无播放中的视频</Text></Box>}
    {error && <Text role="alert" color="red.400" fontSize="xs" my={2}>{error}</Text>}

  </Box>;
}
