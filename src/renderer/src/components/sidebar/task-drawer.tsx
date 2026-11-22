import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import ScheduledPanel from './scheduled-panel';
import TimerPanel, { useTimerPanel } from './timer-panel';
import { FiList } from 'react-icons/fi';
import { useWebSocket } from '@/context/websocket-context';
import { DrawerRoot, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerCloseTrigger, DrawerBackdrop } from '@/components/ui/drawer';

type Task = { id: string; tool: string; status: string; started: number; finished: number | null; can_retry: boolean };
const labels: Record<string, string> = {
  running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消', interrupted: '执行中断',
};

export default function TaskDrawer() {
  const { baseUrl } = useWebSocket();
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/tool-tasks`;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'scheduled' | 'timers' | 'history'>('scheduled');
  const timers = useTimerPanel(open && tab === 'timers');
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error('无法读取任务记录，请检查本机后端连接。');
      setTasks(await response.json());
    } catch (failure) {
      if (!signal?.aborted) setError(String(failure));
    }
  }, [endpoint]);

  useEffect(() => {
    if (!open || tab !== 'history') return undefined;
    const request = new AbortController();
    void refresh(request.signal);
    const timer = window.setInterval(() => void refresh(request.signal), 2000);
    return () => { request.abort(); window.clearInterval(timer); };
  }, [open, tab, refresh]);

  async function act(id: string, action: 'cancel' | 'retry') {
    setPending((state) => ({ ...state, [id]: true }));
    setError('');
    setResult('');
    try {
      const response = await fetch(`${endpoint}/${id}/${action}`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || '操作失败');
      if (action === 'retry') setResult(body.result || (body.success ? '重试已完成' : '重试失败'));
    } catch (failure) {
      setError(String(failure));
    } finally {
      setPending((state) => ({ ...state, [id]: false }));
      void refresh();
    }
  }

  return <DrawerRoot open={open} onOpenChange={(event) => setOpen(event.open)} placement="start">
    <DrawerTrigger asChild><Button aria-label="任务中心" title="任务中心"><FiList /></Button></DrawerTrigger>
    <DrawerBackdrop />
    <DrawerContent className="vt-inspector vt-inspector--tasks" bg="var(--vt-surface)" color="var(--vt-text)">
      <DrawerHeader><DrawerTitle>任务中心</DrawerTitle><DrawerCloseTrigger /></DrawerHeader>
      <DrawerBody>
        <Flex className="vt-inspector-filters" gap={2} mb={4}>
          <Button size="sm" aria-pressed={tab === 'scheduled'} onClick={() => setTab('scheduled')}>定时任务</Button>
          <Button size="sm" aria-pressed={tab === 'timers'} onClick={() => setTab('timers')}>提醒</Button>
          <Button size="sm" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>执行记录</Button>
        </Flex>
        {tab === 'scheduled' && open && <ScheduledPanel />}
        {tab === 'timers' && <TimerPanel state={timers} />}
        {tab === 'history' && <>
        {error && <Text role="alert" color="red.400" mb={3}>{error}</Text>}
        {result && <Text role="status" whiteSpace="pre-wrap" overflowWrap="anywhere" maxH="12rem" overflow="auto" mb={3}>{result}</Text>}
        {tasks === null && !error && <Text>正在加载…</Text>}
        {tasks?.length === 0 && <Text>暂无工具任务</Text>}
        {tasks?.map((task) => <Flex key={task.id} py={3} gap={3} align="center" borderBottom="1px solid var(--vt-border)">
          <Box flex="1" minW={0}>
            <Text truncate>{task.tool}</Text>
            <Text fontSize="xs" color="var(--vt-muted)">
              {labels[task.status] ?? task.status} · {new Date(task.started * 1000).toLocaleString()}
              {task.finished !== null && ` · ${Math.round((task.finished - task.started) * 1000)} ms`}
            </Text>
          </Box>
          {task.status === 'running' && <Button size="xs" disabled={pending[task.id]} onClick={() => void act(task.id, 'cancel')}>取消</Button>}
          {task.can_retry && <Button size="xs" disabled={pending[task.id]} onClick={() => void act(task.id, 'retry')}>重试</Button>}
        </Flex>)}
        </>}
      </DrawerBody>
    </DrawerContent>
  </DrawerRoot>;
}
