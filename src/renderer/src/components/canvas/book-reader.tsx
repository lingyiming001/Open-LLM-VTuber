import { useEffect, useRef, useState } from 'react';
import { Box, Text, Button } from '@chakra-ui/react';
import { useRuntimeStore } from '@/stores/runtime-store';
import { locateSpokenPassage } from '@/services/reader-follow';
import { useContentModeStore } from '@/stores/content-mode-store';
import { useWebSocket } from '@/context/websocket-context';

type Chapter = { title: string; chunks: string[] };
export default function BookReader() {
  const { baseUrl } = useWebSocket();
  const { view, setContentMode } = useContentModeStore();
  const autoPlay = useRef(false);
  const externalReading = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const subtitle = useRuntimeStore((state) => state.subtitleText);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapter, setChapter] = useState(0);
  const [passage, setPassage] = useState(-1);
  const [status, setStatus] = useState('导入 TXT、EPUB 或 PDF 开始阅读');
  const [playing, setPlaying] = useState(false);
  const autoNext = true;
  const rate = 1;
  const generation = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const audio = useRef<HTMLAudioElement | null>(null);
  const controller = useRef<AbortController | null>(null);
  const active = useRef<HTMLParagraphElement | null>(null);
  function stop() {
    generation.current += 1;
    controller.current?.abort();
    if (audio.current) {
      audio.current.pause();
      URL.revokeObjectURL(audio.current.src);
      audio.current = null;
    }
    setPlaying(false);
    if (useContentModeStore.getState().contentMode === 'reading') setContentMode('normal');
  }
  useEffect(() => { if (view !== 'reading') stop(); }, [view]);
  useEffect(() => {
    const open = async (event: Event) => {
      const { path, title: bookTitle, external, start = 0 } = (event as CustomEvent).detail;
      stop();
      externalReading.current = !!external;
      useContentModeStore.getState().setView('reading');
      const token = generation.current;
      try {
        const response = await fetch(`${baseUrl}/api/media/resources/file/books/${path.split('/').map(encodeURIComponent).join('/')}`);
        if (!response.ok) throw Error('无法打开书籍');
        const blob = await response.blob();
        if (token !== generation.current || useContentModeStore.getState().view !== 'reading') return;
        autoPlay.current = !external;
        const loaded = await load(new File([blob], bookTitle || path)) as Chapter[] | undefined;
        if (external && loaded && useContentModeStore.getState().view === 'reading') {
          let remaining = Math.max(0, start);
          let selected = 0;
          while (selected < loaded.length - 1 && remaining >= loaded[selected].chunks.length) {
            remaining -= loaded[selected].chunks.length;
            selected += 1;
          }
          setChapter(selected);
          setPassage(Math.min(remaining, loaded[selected].chunks.length - 1));
          setContentMode('reading');
          setStatus('人物正在朗读本书');
        }
      } catch (error) { setStatus(String(error)); }
    };
    window.addEventListener('vt-read-book', open);
    return () => window.removeEventListener('vt-read-book', open);
  }, [baseUrl]);
  useEffect(() => { if (autoPlay.current && chapters.length && view === 'reading') { autoPlay.current = false; void play(); } }, [chapters]);
  useEffect(() => () => { generation.current += 1; controller.current?.abort(); if (audio.current) { audio.current.pause(); URL.revokeObjectURL(audio.current.src); } }, []);
  useEffect(() => {
    if (view !== 'reading' || !externalReading.current || !subtitle) return;
    const match = locateSpokenPassage(chapters, subtitle, chapter, passage);
    if (match) { setChapter(match.chapter); setPassage(match.passage); }
  }, [subtitle, chapters, view]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return undefined;
    const measure = () => {
      const width = element.clientWidth;
      if (!width) return;
      setPageCount(Math.max(1, Math.ceil((paper.current?.scrollWidth || width) / width)));
      const target = active.current;
      const offset = target ? target.getBoundingClientRect().left - element.getBoundingClientRect().left + element.scrollLeft : 0;
      const next = Math.max(0, Math.floor((offset + 1) / width));
      setPage(next);
      element.scrollTo({ left: next * width, behavior: 'instant' });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paper.current?.animate([{ opacity: 0.4, transform: 'perspective(1600px) rotateY(-6deg) translateX(16px)' }, { opacity: 1, transform: 'perspective(1600px) rotateY(0deg) translateX(0)' }], { duration: 300, easing: 'ease-out' });
    }
    return () => observer.disconnect();
  }, [chapter, chapters, view]);
  useEffect(() => {
    const element = viewport.current;
    const target = active.current;
    if (!element || !target || !element.clientWidth) return;
    const offset = target.getBoundingClientRect().left - element.getBoundingClientRect().left + element.scrollLeft;
    const next = Math.max(0, Math.floor((offset + 1) / element.clientWidth));
    setPage(next);
    element.scrollTo({ left: next * element.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [chapter, passage]);
  function turn(direction: number) {
    const element = viewport.current;
    if (!element) return;
    const next = page + direction;
    if (next >= 0 && next < pageCount) {
      setPage(next);
      element.scrollTo({ left: next * element.clientWidth, behavior: 'smooth' });
    } else if (chapter + direction >= 0 && chapter + direction < chapters.length) {
      stop(); setChapter(chapter + direction); setPassage(-1);
    }
  }
  async function load(file: File) {
    stop();
    const token = generation.current;
    setStatus('正在读取书籍…');
    try {
      const form = new FormData(); form.append('file', file);
      const response = await fetch(`${baseUrl}/api/reader/import`, { method: 'POST', body: form });
      const data = await response.json();
      if (token !== generation.current) return;
      if (!response.ok) throw Error(data.detail || '导入失败');
      setChapters(data.chapters); setChapter(0); setPassage(-1); setStatus('书籍已就绪');
      return data.chapters as Chapter[];
    } catch (e) { if (token === generation.current) setStatus(String(e)); }
  }
  async function play() {
    if (playing || !chapters.length) return;
    const token = ++generation.current;
    setPlaying(true);
    try {
      for (let c = chapter; c < chapters.length; c += 1) {
        setChapter(c);
        for (let p = c === chapter ? Math.max(0, passage) : 0; p < chapters[c].chunks.length; p += 1) {
          setStatus(`正在朗读：${chapters[c].title} · ${p + 1}/${chapters[c].chunks.length}`);
          controller.current = new AbortController();
          const response = await fetch(`${baseUrl}/api/reader/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: chapters[c].chunks[p] }), signal: controller.current.signal });
          if (!response.ok) throw Error('语音合成失败，请检查 TTS 配置');
          const blob = await response.blob();
          if (token !== generation.current) return;
          const current = new Audio(URL.createObjectURL(blob)); audio.current = current; current.playbackRate = rateRef.current;
          await new Promise<void>((resolve, reject) => { current.onplaying = () => { if (token === generation.current) { setPassage(p); setContentMode('reading'); } }; current.onended = () => resolve(); current.onpause = () => resolve(); current.onerror = () => reject(Error('音频播放失败')); current.play().catch(reject); });
          URL.revokeObjectURL(current.src);
          if (token !== generation.current) return;
          audio.current = null;
        }
        setPassage(-1);
        if (!autoNext) { setStatus('本章朗读完成'); setPlaying(false); setContentMode('normal'); return; }
      }
      setStatus('全书朗读完成'); setPlaying(false); setContentMode('normal');
    } catch (e) { if (token === generation.current) { stop(); setStatus(String(e)); } }
  }
  const current = chapters[chapter];
  return <Box position="absolute" inset="0" zIndex={6} bg="#f4f0e7" color="#302c26" display="flex" flexDirection="column" tabIndex={0} aria-label="书籍阅读器" onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); turn(e.key === 'ArrowRight' ? 1 : -1); } }}>
    <Box ref={viewport} flex={1} minH={0} overflow="hidden" mt={10} mb={3} mx={{ base: 4, md: 8 }}>
      <div ref={paper} style={{ height: '100%', width: '100%', columnWidth: viewport.current ? `${viewport.current.clientWidth}px` : 'auto', columnCount: 1, columnGap: 0, columnFill: 'auto', fontSize: 19, lineHeight: 2.1, transformOrigin: 'left center' }}>
        <Text as="h1" fontSize="28px" mb={5} px={4}>{current?.title}</Text>
        {current?.chunks.map((text, i) => <p key={i} ref={i === passage ? active : undefined} aria-current={i === passage ? 'true' : undefined} style={{ background: i === passage ? '#e1dcc7' : undefined, borderRadius: 6, padding: '4px 16px', marginBottom: 12, boxDecorationBreak: 'clone', transition: 'background-color 180ms ease' }}>{text}</p>)}
      </div>
    </Box>
    <Box display="flex" alignItems="center" gap={3} px={4} py={2} borderTop="1px solid #ded7c9">
      <Button size="xs" variant="ghost" aria-label="上一页" disabled={!current || (page === 0 && chapter === 0)} onClick={() => turn(-1)}>‹</Button>
      <Text fontSize="xs" whiteSpace="nowrap">{chapter + 1} / {chapters.length || 1} 章 · {page + 1} / {pageCount} 页</Text>
      <Button size="xs" variant="ghost" aria-label="下一页" disabled={!current || (page === pageCount - 1 && chapter === chapters.length - 1)} onClick={() => turn(1)}>›</Button>
      <Text role="status" flex={1} fontSize="xs" textAlign="right" truncate>{status}</Text>
    </Box>
  </Box>;
}
