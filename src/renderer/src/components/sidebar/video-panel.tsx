import { useEffect, useRef, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { nextMediaPath } from '@/services/media-navigation';
import { useMediaPlaybackStore } from '@/stores/media-playback-store';
import { useWebSocket } from '@/context/websocket-context';
import { useContentModeStore } from '@/stores/content-mode-store';

export default function VideoPanel({ expanded, fit }: { expanded: boolean; fit: 'contain' | 'cover' }) {
  const { baseUrl } = useWebSocket();
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const { setContentMode, reset } = useContentModeStore();
  useEffect(() => {
    if (expanded && path) void video.current?.play().catch(() => setError('请点击播放按钮开始播放'));
    else video.current?.pause();
  }, [path, expanded]);
  useEffect(() => {
    let disposed = false;
    const listener = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.kind && detail.kind !== 'videos') return;
      if (detail.action === 'next' || detail.action === 'previous') {
        if (!detail.kind && useMediaPlaybackStore.getState().kind !== 'videos') return;
        void (async () => {
          try {
            const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/media/library`);
            if (!response.ok) throw Error('无法加载视频库');
            const library = await response.json();
            if (disposed) return;
            const next = nextMediaPath(library.videos, path, detail.action === 'next' ? 1 : -1);
            if (!next) throw Error('没有其他可切换的视频，请先导入更多文件。');
            setError(''); setPath(next); useContentModeStore.getState().setView('video');
          } catch (e) { if (!disposed) setError(String(e)); }
        })();
        return;
      }
      if (detail.action === 'play' && detail.path) {
        setError(''); setPath(detail.path);
        if (path === detail.path) void video.current?.play().catch(() => setError('请点击播放按钮开始播放'));
      }
      if (detail.action === 'pause') video.current?.pause();
      if (detail.action === 'resume' && path) {
        useContentModeStore.getState().setView('video');
        void video.current?.play().catch(() => setError('请点击播放按钮继续播放'));
      }
      if (detail.action === 'stop') { video.current?.pause(); setPath(''); reset(); }
    };
    const stop = () => { video.current?.pause(); reset(); };
    window.addEventListener('vtuber-stage-action', listener); window.addEventListener('vtuber-emergency-stop', stop);
    return () => { disposed = true; window.removeEventListener('vtuber-stage-action', listener); window.removeEventListener('vtuber-emergency-stop', stop); };
  }, [path, reset]);
  return <Box position="absolute" inset="0" zIndex={6} bg="#09090b" color="white" display={expanded ? 'block' : 'none'}>
    {path && <video ref={video} src={`${baseUrl.replace(/\/$/, '')}/api/media/file/videos/${path.split('/').map(encodeURIComponent).join('/')}`} controls playsInline onPlay={() => { setContentMode('video'); useMediaPlaybackStore.getState().setKind('videos'); }} onPause={() => { if (useContentModeStore.getState().contentMode === 'video') setContentMode('normal'); }} onEnded={reset} onError={() => { setError('视频加载失败或格式不受支持'); setContentMode('normal'); }} style={{ width: '100%', height: '100%', objectFit: fit, background: '#09090b' }} />}
    {error && <Text role="alert" position="absolute" top="64px" left="16px" color="red.300">{error}</Text>}
  </Box>;
}
