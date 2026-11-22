import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Text } from '@chakra-ui/react';
import { FiMonitor, FiGlobe, FiLock, FiShield, FiRefreshCw, FiSquare, FiArrowUpRight } from 'react-icons/fi';
import { useWebSocket } from '@/context/websocket-context';
import type { ReactNode } from 'react';

type State = {
  settings: { computer: boolean; browser: boolean; stopped: boolean };
  permissions: { supported: boolean; screen: boolean; accessibility: boolean; locked: boolean; message: string };
  browserInstalled: boolean;
  browserRunning: boolean;
  running: boolean;
  live: boolean;
  events: { kind: string; action: string; status: string; time: string }[];
};

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange} className="control-toggle" data-checked={checked}>
    <span />
  </button>;
}

function Row({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <Box className="control-row">
    <Box className="control-icon">{icon}</Box>
    <Box flex="1" minW="0"><Text fontWeight="600" fontSize="15px">{title}</Text><Text color="var(--vt-muted)" fontSize="13px" lineHeight="1.6" mt="3px">{description}</Text></Box>
    <Box flexShrink="0">{children}</Box>
  </Box>;
}

export default function ComputerUse() {
  const { baseUrl } = useWebSocket();
  const api = `${baseUrl.replace(/\/$/, '')}/api/control`;
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch(api);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || '无法读取控制状态');
    setState(data);
  }, [api]);
  useEffect(() => {
    void refresh().catch((e) => setError(e.message));
    const timer = window.setInterval(() => { void refresh().catch((e) => setError(e.message)); }, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  async function action(path: string, method = 'POST', body?: object) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`${api}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '操作失败');
      setMessage(data.message || (path === '/stop' ? '已停止操作，并关闭两个控制开关' : '已更新，立即生效'));
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  }
  return <Box className="computer-use-settings" pb={5}>
    <style>{`
      .computer-use-settings { color: var(--vt-text); }
      .control-card { border: 1px solid var(--vt-border); border-radius: 18px; padding: 0 18px; background: var(--vt-surface); }
      .control-row { display: flex; align-items: center; gap: 14px; padding: 20px 0; }
      .control-row + .control-row { border-top: 1px solid var(--vt-border); }
      .control-icon { width: 42px; height: 42px; border-radius: 12px; background: var(--vt-raised); display: flex; align-items: center; justify-content: center; color: var(--vt-accent); font-size: 22px; flex-shrink: 0; }
      .control-toggle { display: flex; align-items: center; width: 46px; height: 28px; padding: 3px; border: 1px solid var(--vt-border); border-radius: 30px; background: var(--vt-muted); cursor: pointer; transition: background .15s; }
      .control-toggle[data-checked="true"] { background: #0782ff; border-color: #0782ff; }
      .control-toggle span { width: 20px; height: 20px; border-radius: 50%; background: white; transition: transform .15s; }
      .control-toggle[data-checked="true"] span { transform: translateX(18px); }
      .control-toggle:disabled { opacity: .45; cursor: not-allowed; }
      .control-toggle:focus-visible { outline: 2px solid var(--vt-accent); outline-offset: 4px; }
      @media(max-width: 480px) { .control-card { padding: 0 12px; } .control-row { gap: 10px; } .control-icon { width: 32px; height: 32px; font-size: 18px; } }
    `}</style>
    <Text fontSize={{ base: '25px', md: '30px' }} fontWeight="600" letterSpacing="-.6px">Computer use</Text>
    <Text mt={2} mb={6} fontSize="14px" lineHeight="1.7" color="var(--vt-muted)">管理角色如何使用你的电脑与浏览器。开关立即生效，无需保存。</Text>
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} mb={3}>
      <Text fontSize="13px" fontWeight="600">控制能力</Text>
      <Button size="xs" variant="ghost" color="var(--vt-text)" disabled={busy} onClick={() => { setError(''); void refresh().catch((e) => setError(e.message)); }}><FiRefreshCw />刷新状态</Button>
    </Box>
    {error && <Box role="alert" mb={4} p={3} borderRadius="lg" bg="var(--vt-raised)" color="red.400" fontSize="13px" overflowWrap="anywhere">{error}</Box>}
    {!state && !error && <Text role="status" color="var(--vt-muted)" py={6}>正在读取能力状态…</Text>}
    {state && <>
      <Box className="control-card">
        <Row icon={<FiMonitor />} title="电脑控制" description="观察主屏幕，打开应用，使用鼠标和键盘。">
          <Toggle label="启用电脑控制" checked={state.settings.computer} disabled={busy || !state.permissions.supported || state.live} onChange={() => action('', 'PATCH', { computer: !state.settings.computer })} />
        </Row>
        <Row icon={<FiGlobe />} title="Browser use" description="在独立 Chromium 会话中浏览网页、点击与填写。">
          <Toggle label="启用浏览器控制" checked={state.settings.browser} disabled={busy || !state.browserInstalled || state.live} onChange={() => action('', 'PATCH', { browser: !state.settings.browser })} />
        </Row>
      </Box>
      <Box display="flex" gap={2} flexWrap="wrap" mt={3} mb={6}>
        <Button size="xs" variant="outline" color="var(--vt-text)" borderColor="var(--vt-border)" disabled={busy || !state.settings.computer} onClick={() => action('/probe/computer')}>测试截屏</Button>
        <Button size="xs" variant="outline" color="var(--vt-text)" borderColor="var(--vt-border)" disabled={busy || !state.settings.browser} onClick={() => action('/probe/browser')}>{state.browserRunning ? '检查浏览器' : '打开专用浏览器'}</Button>
        <Text alignSelf="center" fontSize="12px" color="var(--vt-muted)">{state.browserRunning ? '浏览器会话运行中' : '浏览器未启动'}</Text>
      </Box>
      <Text fontSize="13px" fontWeight="600" mb={3}>系统权限</Text>
      <Box className="control-card">
        <Row icon={<FiMonitor />} title="屏幕录制" description={state.permissions.screen ? '已授权 · 可观察屏幕内容' : '未授权 · 需为启动后端的应用开启权限'}>
          <Button size="xs" variant="ghost" color="var(--vt-text)" disabled={busy || !state.permissions.supported} onClick={() => action('/permissions/screen')}>管理<FiArrowUpRight /></Button>
        </Row>
        <Row icon={<FiShield />} title="辅助功能" description={state.permissions.accessibility ? '已授权 · 可操作鼠标与键盘' : '未授权 · 需在 macOS 系统设置中开启'}>
          <Button size="xs" variant="ghost" color="var(--vt-text)" disabled={busy || !state.permissions.supported} onClick={() => action('/permissions/accessibility')}>管理<FiArrowUpRight /></Button>
        </Row>
      </Box>
      <Box className="control-card" mt={3}>
        <Row icon={<FiLock />} title="锁屏使用" description={state.permissions.locked ? '屏幕已锁定，电脑操作被阻止' : '锁屏时停止电脑操作；当前不支持锁屏控制'}><Text fontSize="12px" color="var(--vt-muted)">不可用</Text></Row>
      </Box>
      {(!state.browserInstalled || !state.permissions.supported) && <Box mt={4} p={3} bg="var(--vt-raised)" borderRadius="lg" fontSize="12px"><Text mb={2}>安装控制依赖后重启后端：</Text><code>uv sync --extra control<br />uv run --extra control playwright install chromium</code></Box>}
      <Box mt={5} display="flex" gap={3} alignItems="center" justifyContent="space-between">
        <Text fontSize="12px" color="var(--vt-muted)">{state.settings.stopped ? '控制已停止，重新开启开关可恢复' : state.running ? '正在执行操作…' : '仅响应本机对话；直播与主动闲聊不可使用'}</Text>
        <Button size="sm" colorPalette="red" variant="outline" onClick={() => action('/stop')}><FiSquare />立即停止</Button>
      </Box>
      <Text role="status" fontSize="13px" color="var(--vt-accent)" mt={3}>{busy ? '正在处理…' : message}</Text>
      <Text fontSize="12px" lineHeight="1.8" mt={4} color="var(--vt-muted)">电脑控制需要支持图像输入的聊天模型。专用浏览器单独保留登录状态，不会接管你日常的 Chrome 标签页。网页读取可使用文字快照。</Text>
      <details style={{ marginTop: 20, fontSize: 12, color: 'var(--vt-muted)' }}><summary>最近操作 · {state.events.length}</summary>
        {!state.events.length && <Text mt={3}>还没有执行操作</Text>}
        {state.events.slice(0, 8).map((event, index) => <Box key={`${event.time}-${index}`} display="flex" gap={2} justifyContent="space-between" py={2} borderBottom="1px solid var(--vt-border)"><Text>{event.kind === 'computer' ? '电脑' : '浏览器'} · {event.action}</Text><Text>{event.status === 'completed' ? '已执行' : event.status === 'stopped' ? '已停止' : '失败'} · {new Date(event.time).toLocaleTimeString()}</Text></Box>)}
      </details>
    </>}
  </Box>;
}
