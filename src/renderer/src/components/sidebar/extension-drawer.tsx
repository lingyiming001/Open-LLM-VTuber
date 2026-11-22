import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Input, Text, Textarea } from '@chakra-ui/react';
import { FiGrid, FiUpload, FiPlus, FiPackage } from 'react-icons/fi';
import { useWebSocket } from '@/context/websocket-context';
import { DrawerRoot, DrawerTrigger, DrawerBackdrop, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerCloseTrigger } from '@/components/ui/drawer';
import ComputerUse from './setting/computer-use';

type Extension = { id: string; name: string; description: string; kind: string; enabled: boolean; skills: { name: string }[]; servers: string[] };
const template = '{\n  "command": "uvx",\n  "args": ["mcp-server-time"],\n  "env": {}\n}';

export default function ExtensionDrawer() {
  const { baseUrl } = useWebSocket();
  const api = `${baseUrl.replace(/\/$/, '')}/api/extensions`;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Extension[]>([]);
  const [builtin, setBuiltin] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [config, setConfig] = useState(template);
  const [removing, setRemoving] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const response = await fetch(api);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || '加载扩展失败');
    setItems(data.items); setBuiltin(data.builtin);
  }, [api]);
  useEffect(() => { if (open) { setError(''); refresh().catch((e) => setError(e.message)); } }, [open, refresh]);
  async function action(path: string, method: string, body?: BodyInit, binary = false) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${api}${path}`, { method, headers: { 'Content-Type': binary ? 'application/octet-stream' : 'application/json' }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '请检查输入格式');
      setMessage(data.message + (data.results ? `：${data.results.map((r: { server: string; tools: string[] }) => `${r.server} (${r.tools.join('、') || '无工具'})`).join('；')}` : ''));
      await refresh(); setRemoving('');
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  return <DrawerRoot open={open} onOpenChange={(e) => setOpen(e.open)} placement="start">
    <DrawerTrigger asChild><Button aria-label="扩展" title="扩展"><FiGrid /></Button></DrawerTrigger>
    <DrawerBackdrop />
    <DrawerContent className="vt-feature-drawer vt-inspector vt-inspector--extensions" bg="var(--vt-surface)" color="var(--vt-text)" maxWidth="720px">
      <DrawerHeader display="block" position="relative" pr={14}><DrawerTitle>扩展</DrawerTitle><Text mt={2} fontSize="sm" color="var(--vt-muted)">为角色添加技能与外部工具</Text><DrawerCloseTrigger /></DrawerHeader>
      <DrawerBody>
        <Box display="flex" gap={2} mb={4} flexWrap="wrap">
          <Button disabled={busy} onClick={() => input.current?.click()}><FiUpload />安装插件 / Skill</Button>
          <Button disabled={busy} onClick={() => setAdding(!adding)}><FiPlus />添加 MCP</Button>
          <input type="file" accept=".zip,.md" hidden ref={input} onChange={(e) => { const file = e.target.files?.[0]; if (file) { if (file.size > 5 * 1024 * 1024) setError('安装包不能超过 5 MB'); else void action(`/install?filename=${encodeURIComponent(file.name)}`, 'POST', file, true); } e.target.value = ''; }} />
        </Box>
        <Text fontSize="xs" color="var(--vt-muted)" mb={4}>支持 SKILL.md、Skill ZIP 和本应用插件 ZIP。安装后默认停用，启用 Skills 后下次对话生效；MCP 变更需重启后端。仅安装可信来源，MCP 可执行本地命令。</Text>
        {adding && <Box border="1px solid var(--vt-border)" borderRadius="lg" p={4} mb={4}>
          <Text fontSize="sm" mb={2}>服务名称（唯一 ID）</Text><Input aria-label="MCP 服务名称" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 local-time" mb={3} />
          <Text fontSize="sm" mb={2}>stdio 配置（JSON）</Text><Textarea aria-label="MCP 配置" value={config} onChange={(e) => setConfig(e.target.value)} rows={8} fontFamily="mono" />
          <Button mt={3} disabled={busy || !name.trim()} onClick={() => { try { const parsed = JSON.parse(config); void action('/mcp', 'POST', JSON.stringify({ id: name.trim(), config: parsed })); } catch { setError('配置不是有效 JSON'); } }}>保存 MCP</Button>
        </Box>}
        <details style={{ marginBottom: 20, color: 'var(--vt-muted)', fontSize: 13 }}><summary>插件包格式</summary><Text mt={2}>ZIP 内放置 plugin.json 和可选的 skills/技能名/SKILL.md。插件组合技能说明与 MCP 工具，不运行安装脚本。Skill 的附属脚本和参考文件暂不加载。</Text><pre style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{'{\n  "id": "my-plugin",\n  "name": "我的插件",\n  "description": "插件说明",\n  "mcpServers": {\n    "my-time": {\n      "command": "uvx",\n      "args": ["mcp-server-time"]\n    }\n  }\n}'}</pre></details>
        <Text role="status" color="var(--vt-accent)" fontSize="sm" mb={3}>{busy ? '正在处理…' : message}</Text>
        {error && <Box role="alert" color="red.400" fontSize="sm" mb={3}>{error}<Button size="xs" ml={2} onClick={() => refresh().then(() => setError('')).catch((e) => setError(e.message))}>重试</Button></Box>}
        <Box className="vt-inspector-filters" display="flex" gap={2} mb={4}>{[['all', '全部'], ['plugin', '插件'], ['skill', 'Skills'], ['mcp', 'MCP']].map(([value, label]) => <Button key={value} size="sm" aria-pressed={filter === value} onClick={() => setFilter(value)} bg={filter === value ? 'var(--vt-accent)' : 'var(--vt-raised)'} color={filter === value ? 'white' : 'var(--vt-text)'}>{label}</Button>)}</Box>
        {items.filter((item) => filter === 'all' || item.kind === filter).map((item) => <Box className="vt-extension-row" key={item.id} border="1px solid var(--vt-border)" p={4} borderRadius="lg" mb={3}>
          <Box display="flex" gap={2} alignItems="center"><FiPackage /><Text fontWeight="semibold" flex={1}>{item.name}</Text><Text fontSize="xs" color="var(--vt-muted)">{item.enabled ? '已启用' : '已停用'}</Text></Box>
          <Text fontSize="sm" color="var(--vt-muted)" my={2}>{item.description || item.id}</Text>
          <Text fontSize="xs" color="var(--vt-muted)" mb={3}>{item.skills.length} 个技能 · {item.servers.length} 个 MCP 服务{item.servers.length ? ` · ${item.servers.join('、')}` : ''}</Text>
          <Box display="flex" gap={2} flexWrap="wrap"><Button size="xs" disabled={busy} onClick={() => action(`/${encodeURIComponent(item.id)}`, 'PATCH', JSON.stringify({ enabled: !item.enabled }))}>{item.enabled ? '停用' : '启用'}</Button>
            {!!item.servers.length && <Button size="xs" disabled={busy} onClick={() => action(`/${encodeURIComponent(item.id)}/test`, 'POST')}>测试连接（运行服务）</Button>}
            <Button size="xs" disabled={busy} onClick={() => setRemoving(item.id)}>移除</Button></Box>
          {removing === item.id && <Box mt={3}><Text fontSize="xs" mb={2}>移除后可重新导入安装包。</Text><Button size="xs" disabled={busy} onClick={() => action(`/${encodeURIComponent(item.id)}`, 'DELETE')}>确认移除</Button><Button size="xs" ml={2} onClick={() => setRemoving('')}>取消</Button></Box>}
        </Box>)}
        {!items.length && <Text textAlign="center" color="var(--vt-muted)" py={8}>还没有安装扩展</Text>}
        {!!builtin.length && <Text fontSize="xs" color="var(--vt-muted)" mt={5}>后端已注册 MCP：{builtin.join('、')}</Text>}
        <Box borderTop="1px solid var(--vt-border)" mt={7} pt={7}>
          <ComputerUse />
        </Box>
      </DrawerBody>
    </DrawerContent>
  </DrawerRoot>;
}
