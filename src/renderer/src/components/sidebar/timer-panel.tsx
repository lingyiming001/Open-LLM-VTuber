import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Flex, Input, Text } from '@chakra-ui/react';
import { useWebSocket } from '@/context/websocket-context';
import { toaster } from '@/components/ui/toaster';

type Timer = { id: string; title: string; due: number; status: 'pending' | 'due' | 'dismissed' };

export function useTimerPanel(visible: boolean) {
  const { baseUrl } = useWebSocket();
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/timers`;
  const [timers, setTimers] = useState<Timer[]>([]);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('5');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const notified = useRef(new Set<string>());

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error('无法加载定时器');
      const rows: Timer[] = await response.json();
      setTimers(rows.filter((timer) => timer.status !== 'dismissed'));
      for (const timer of rows) {
        if (timer.status !== 'due' || notified.current.has(timer.id)) continue;
        notified.current.add(timer.id);
        toaster.create({ title: timer.title, description: '定时提醒已到期', type: 'info', duration: 8000 });
      }
    } catch (failure) {
      if (!signal?.aborted && visible) setError(String(failure));
    }
  }, [endpoint, visible]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(controller.signal), 3000);
    return () => { controller.abort(); window.clearInterval(interval); };
  }, [refresh]);

  async function mutate(path: string, payload?: object) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint + path, {
        method: 'POST',
        headers: payload ? { 'Content-Type': 'application/json' } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      if (!response.ok) throw new Error('定时器操作失败，请检查输入或后端连接。');
      if (payload) setTitle('');
      await refresh();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }

  return { timers, title, setTitle, minutes, setMinutes, busy, error, mutate };
}

export default function TimerPanel({ state }: { state: ReturnType<typeof useTimerPanel> }) {
  const { timers, title, setTitle, minutes, setMinutes, busy, error, mutate } = state;
  return <>
    <form className="vt-inspector-form" onSubmit={(event) => {
      event.preventDefault();
      void mutate('', { title: title.trim(), seconds: Math.round(Number(minutes) * 60) });
    }}>
      <Input aria-label="提醒内容" placeholder="提醒内容" value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} required />
      <Flex align="center" gap={2} my={3}>
        <Input aria-label="延迟分钟数" type="number" min={1} max={525600} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
        <Text flexShrink={0}>分钟后</Text>
        <Button type="submit" size="sm" disabled={busy || !title.trim()}>添加提醒</Button>
      </Flex>
    </form>
    {error && <Text role="alert" color="red.400">{error}</Text>}
    {!timers.length && !error && <Text color="var(--vt-muted)">暂无定时提醒</Text>}
    {timers.map((timer) => <Flex key={timer.id} gap={3} align="center" py={3} borderBottom="1px solid var(--vt-border)">
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text overflowWrap="anywhere">{timer.title}</Text>
        <Text fontSize="xs" color="var(--vt-muted)">{timer.status === 'due' ? '已到期 · ' : ''}{new Date(timer.due * 1000).toLocaleString()}</Text>
      </div>
      <Button size="xs" disabled={busy} onClick={() => void mutate(`/${timer.id}/dismiss`)}>{timer.status === 'due' ? '知道了' : '取消提醒'}</Button>
    </Flex>)}
  </>;
}
