import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Input, Text } from '@chakra-ui/react';
import { FiFolder, FiUpload, FiFilm, FiMusic, FiImage, FiBookOpen } from 'react-icons/fi';
import { useWebSocket } from '@/context/websocket-context';
import { DrawerRoot, DrawerTrigger, DrawerBackdrop, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerCloseTrigger } from '@/components/ui/drawer';

type Kind = 'videos' | 'music' | 'images' | 'books';
type Resource = { kind: Kind; path: string; title: string; size: number };
const categories = [
  { kind: 'videos', label: '视频', icon: FiFilm, extensions: ['mp4', 'webm', 'mov', 'm4v', 'ogv'] },
  { kind: 'music', label: '音乐', icon: FiMusic, extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'] },
  { kind: 'images', label: '图片', icon: FiImage, extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] },
  { kind: 'books', label: '书籍', icon: FiBookOpen, extensions: ['pdf', 'epub', 'txt'] },
] as const;
const accept = categories.flatMap((c) => c.extensions.map((ext) => `.${ext}`)).join(',');

export default function ResourceDrawer() {
  const { baseUrl } = useWebSocket();
  const api = `${baseUrl.replace(/\/$/, '')}/api/media`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Resource[]>([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Resource | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const openVideos = () => { setFilter('videos'); setOpen(true); };
    window.addEventListener('vt-open-resource-videos', openVideos);
    return () => window.removeEventListener('vt-open-resource-videos', openVideos);
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${api}/resources`);
      if (!response.ok) throw new Error('无法加载资源库，请确认后端已更新并启动。');
      setItems(await response.json());
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { if (open) { setError(''); void refresh(); } else setSelected(null); }, [open, refresh]);
  const fileUrl = (item: Resource) => `${api}/resources/file/${item.kind}/${item.path.split('/').map(encodeURIComponent).join('/')}`;
  async function importFiles(files: File[]) {
    if (busy || !files.length) return;
    setBusy(true); setError(''); setMessage('');
    let count = 0;
    const failures: string[] = [];
    for (const [index, file] of files.entries()) {
      setMessage(`正在导入 ${index + 1}/${files.length}：${file.name}`);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const category = categories.find((c) => (c.extensions as readonly string[]).includes(ext));
      if (!category) { failures.push(`${file.name}：不支持此格式`); continue; }
      if (file.size > (category.kind === 'books' ? 30 : 500) * 1024 * 1024) {
        failures.push(`${file.name}：超过大小限制`); continue;
      }
      try {
        const response = await fetch(`${api}/resources/${category.kind}?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file,
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => ({}));
          throw new Error(detail.detail || `导入失败 (${response.status})`);
        }
        count += 1;
      } catch (e) { failures.push(`${file.name}：${e instanceof Error ? e.message : '导入失败'}`); }
    }
    setMessage(`已导入 ${count} 个文件`); setError(failures.join('\n'));
    await refresh(); window.dispatchEvent(new Event('vt-resources-changed')); setBusy(false);
  }
  const visible = items.filter((item) => (filter === 'all' || item.kind === filter) && item.title.toLowerCase().includes(search.toLowerCase()));
  return (
    <DrawerRoot open={open} onOpenChange={(e) => setOpen(e.open)} placement="start">
      <DrawerTrigger asChild><Button aria-label="资源库" title="资源库"><FiFolder /></Button></DrawerTrigger>
      <DrawerBackdrop />
      <DrawerContent className="vt-feature-drawer vt-inspector vt-inspector--resources" bg="var(--vt-surface)" color="var(--vt-text)" width="620px" maxW="100vw">
        <DrawerHeader borderBottom="1px solid" borderColor="whiteAlpha.100" pb={5}>
          <DrawerTitle fontSize="xl">资源库</DrawerTitle>
          <DrawerCloseTrigger />
        </DrawerHeader>
        <DrawerBody py={5}>
          <Box className="vt-resource-upload" border="1px dashed" borderColor="whiteAlpha.300" borderRadius="xl" p={3} textAlign="center" bg="whiteAlpha.50"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void importFiles(Array.from(e.dataTransfer.files)); }}>
            <Button onClick={() => input.current?.click()} disabled={busy}><FiUpload />{busy ? '正在导入…' : '导入资源'}</Button>
            <input ref={input} type="file" multiple accept={accept} hidden onChange={(e) => { void importFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
            <Text mt={3} fontSize="sm" color="var(--vt-muted)">点击选择或拖入视频、音乐、图片、书籍</Text>
            <Text mt={2} fontSize="xs" color="var(--vt-muted)">书籍支持 PDF / EPUB / TXT，最大 30 MB；其他文件最大 500 MB</Text>
          </Box>
          <Text role="status" fontSize="sm" color="green.300" mt={3}>{message}</Text>
          {error && <Box role="alert" color="red.300" fontSize="sm" whiteSpace="pre-wrap" my={3}>{error}<Button size="xs" ml={2} onClick={() => { setError(''); void refresh(); }}>刷新</Button></Box>}
          <Box className="vt-inspector-filters" display="flex" gap={2} flexWrap="wrap" my={4}>
            {[{ kind: 'all', label: '全部' }, ...categories].map((c) => <Button key={c.kind} aria-pressed={filter === c.kind} size="sm" bg={filter === c.kind ? 'var(--vt-accent)' : 'var(--vt-raised)'} color={filter === c.kind ? 'white' : 'var(--vt-text)'} onClick={() => setFilter(c.kind)}>{c.label} {items.filter((i) => c.kind === 'all' || i.kind === c.kind).length}</Button>)}
          </Box>
          <Input aria-label="搜索资源" placeholder="搜索资源名称…" value={search} onChange={(e) => setSearch(e.target.value)} mb={4} />
          {selected && <Box mb={4} p={3} borderRadius="lg" bg="blackAlpha.400">
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}><Text truncate>{selected.title}</Text><Button size="xs" onClick={() => setSelected(null)}>关闭预览</Button></Box>
            {selected.kind === 'images' && <img src={fileUrl(selected)} alt={selected.title} style={{ maxWidth: '100%', maxHeight: 300, margin: 'auto' }} />}
            {selected.kind === 'videos' && <video key={selected.path} src={fileUrl(selected)} controls style={{ width: '100%', maxHeight: 300 }} />}
            {selected.kind === 'music' && <audio key={selected.path} src={fileUrl(selected)} controls style={{ width: '100%' }} />}
            {selected.kind === 'books' && <Text fontSize="sm" color="var(--vt-muted)">点击下方链接打开书籍；EPUB 需使用本地阅读器。</Text>}
            <a href={fileUrl(selected)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, color: '#a5b4fc', fontSize: 13 }}>打开原文件 ↗</a>
          </Box>}
          {loading ? <Text color="var(--vt-muted)">正在加载…</Text> : visible.length === 0 ? <Box textAlign="center" py={10} color="var(--vt-muted)">{items.length ? '没有匹配的资源' : '资源库还是空的，导入第一份素材吧'}</Box> : visible.map((item) => {
            const category = categories.find((c) => c.kind === item.kind)!;
            const Icon = category.icon;
            return <Button className="vt-resource-row" key={`${item.kind}/${item.path}`} variant="ghost" color="var(--vt-text)" width="100%" height="auto" py={3} px={3} mb={1} justifyContent="flex-start" onClick={() => {
                if (item.kind === 'music' || item.kind === 'videos') {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent('vtuber-stage-action', { detail: { action: 'play', kind: item.kind, path: item.path } }));
                } else if (item.kind === 'books') {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent('vt-read-book', { detail: { path: item.path, title: item.title } }));
                } else setSelected(item);
              }}>
              <Box className="vt-resource-icon" p={2}><Icon /></Box>
              <Box textAlign="left" minW={0} flex={1}><Text truncate fontWeight="medium">{item.title}</Text><Text fontSize="xs" color="var(--vt-muted)" mt={1}>{category.label} · {(item.size / 1024 / 1024).toFixed(1)} MB</Text></Box>
            </Button>;
          })}
        </DrawerBody>
      </DrawerContent>
    </DrawerRoot>
  );
}
