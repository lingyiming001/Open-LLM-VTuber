import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Input, Text } from '@chakra-ui/react';
import { FiMusic, FiPlay, FiPause, FiSkipBack, FiSkipForward, FiRefreshCw, FiRepeat, FiVolume2 } from 'react-icons/fi';
import { nextMediaPath } from '@/services/media-navigation';
import { useMediaPlaybackStore } from '@/stores/media-playback-store';
import { useWebSocket } from '@/context/websocket-context';

type Track = { title: string; path: string };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function MusicPanel() {
  const { baseUrl } = useWebSocket();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [path, setPath] = useState('');
  const [search, setSearch] = useState('');
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => { const saved = Number(localStorage.getItem('vt-music-volume') ?? 0.7); return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.7; });
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const autoPlay = useRef(false);
  const current = tracks.find((track) => track.path === path);
  const src = path ? `${baseUrl.replace(/\/$/, '')}/api/media/file/music/${path.split('/').map(encodeURIComponent).join('/')}` : undefined;
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/media/library`);
      if (!response.ok) throw new Error('无法加载音乐列表');
      const data = await response.json(); setTracks(data.music);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [baseUrl]);
  useEffect(() => {
    void refresh();
    const listener = () => { void refresh(); };
    window.addEventListener('vt-resources-changed', listener);
    return () => window.removeEventListener('vt-resources-changed', listener);
  }, [refresh]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
    localStorage.setItem('vt-music-volume', String(volume));
  }, [volume]);
  useEffect(() => {
    setPosition(0); setDuration(0); setPlaying(false);
    if (src && autoPlay.current) {
      audio.current?.play().catch(() => { setError('播放未开始，请点击播放；若仍失败，请检查浏览器是否支持该音频格式。'); });
      autoPlay.current = false;
    }
  }, [src]);
  useEffect(() => {
    const control = (event: Event) => {
      const { action, kind, path: requestedPath } = (event as CustomEvent).detail;
      if (kind && kind !== 'music') return;
      if ((action === 'next' || action === 'previous') && (!kind && useMediaPlaybackStore.getState().kind !== 'music')) return;
      if (action === 'next' || action === 'previous') { skip(action === 'next' ? 1 : -1); return; }
      if (action === 'play' && requestedPath) {
        setTracks((previous) => previous.some((t) => t.path === requestedPath) ? previous : [...previous, { path: requestedPath, title: requestedPath.split('/').pop() }]);
        setError(''); autoPlay.current = true;
        if (requestedPath === path) void audio.current?.play().catch(() => setError('请点击播放按钮开始播放'));
        else setPath(requestedPath);
      }
      if (action === 'pause') audio.current?.pause();
      if (action === 'resume' && path) void audio.current?.play().catch(() => setError('请点击播放按钮继续播放'));
      if (action === 'stop') { audio.current?.pause(); setPath(''); }
    };
    const stop = () => { audio.current?.pause(); };
    window.addEventListener('vtuber-stage-action', control);
    window.addEventListener('vtuber-emergency-stop', stop);
    return () => { window.removeEventListener('vtuber-stage-action', control); window.removeEventListener('vtuber-emergency-stop', stop); };
  }, [path, tracks]);
  function select(track: Track) {
    setError('');
    if (track.path === path) { void audio.current?.play().catch(() => setError('无法播放此文件')); return; }
    autoPlay.current = true; setPath(track.path);
  }
  function skip(delta: number) {
    const next = nextMediaPath(tracks, path, delta);
    if (!next) { setError('没有其他可切换的音乐，请先导入更多文件。'); return; }
    select(tracks.find((track) => track.path === next)!);
  }
  function toggle() {
    if (!current) { if (tracks[0]) select(tracks[0]); return; }
    if (playing) audio.current?.pause();
    else { setError(''); void audio.current?.play().catch(() => setError('无法播放此文件，请检查音频格式')); }
  }
  return <Box className="vt-music" px={4} color="var(--vt-text)">
    <audio ref={audio} src={src} preload="metadata" onPlay={() => { setPlaying(true); useMediaPlaybackStore.getState().setKind('music'); }} onPause={() => setPlaying(false)}
      onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)}
      onLoadedMetadata={() => setDuration(Number.isFinite(audio.current?.duration) ? audio.current!.duration : 0)}
      onError={() => { if (src) { setPlaying(false); setError('音频加载失败或格式不受支持，请选择其他音乐。'); } }}
      onEnded={() => { if (repeat && audio.current) { audio.current.currentTime = 0; void audio.current.play().catch(() => setError('无法继续播放')); } else skip(1); }} />
    <Box className="vt-media-preview" bg="var(--vt-surface)" border="1px solid var(--vt-border)" borderRadius="lg" minH="240px" p={4} display="flex" flexDirection="column" justifyContent="center">
      {!current ? <Box display="flex" flexDirection="column" alignItems="center" gap={3} color="var(--vt-muted)"><FiMusic size={28} /><Text>暂无播放中的音乐</Text></Box> : <>
      <Text textAlign="center" truncate fontWeight="medium">{current.title}</Text>
      <Box mt={4}><input aria-label="播放进度" type="range" min={0} max={duration || 1} step={0.1} value={Math.min(position, duration || 1)} disabled={!duration} style={{ width: '100%' }} onChange={(e) => { const next = Number(e.target.value); if (audio.current) audio.current.currentTime = next; setPosition(next); }} /><Box display="flex" justifyContent="space-between" fontSize="xs" color="var(--vt-muted)"><span>{time(position)}</span><span>{time(duration)}</span></Box></Box>
      <Box display="flex" gap={3} justifyContent="center" alignItems="center" mt={2}>
        <Button size="sm" aria-label={repeat ? '取消单曲循环' : '单曲循环'} title={repeat ? '单曲循环' : '列表循环'} aria-pressed={repeat} onClick={() => setRepeat(!repeat)} color={repeat ? 'var(--vt-accent)' : 'var(--vt-muted)'} bg="transparent"><FiRepeat /></Button>
        <Button size="sm" aria-label="上一首" disabled={!tracks.length} onClick={() => skip(-1)} bg="transparent"><FiSkipBack /></Button>
        <Button aria-label={playing ? '暂停音乐' : '播放音乐'} disabled={!tracks.length} onClick={toggle} borderRadius="full" bg="var(--vt-accent)" color="white!important">{playing ? <FiPause /> : <FiPlay />}</Button>
        <Button size="sm" aria-label="下一首" disabled={!tracks.length} onClick={() => skip(1)} bg="transparent"><FiSkipForward /></Button>
        <Box display="flex" gap={1} alignItems="center"><FiVolume2 /><input aria-label="音乐音量" type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} style={{ width: 55 }} /></Box>
      </Box>
      </>}
    </Box>
    {error && <Text role="alert" color="red.400" fontSize="xs" mt={2}>{error}</Text>}

  </Box>;
}
