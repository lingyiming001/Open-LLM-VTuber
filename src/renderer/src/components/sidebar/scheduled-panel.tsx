import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Input, Text, Textarea } from '@chakra-ui/react';
import { useWebSocket } from '@/context/websocket-context';

type Job = { id: string; title: string; prompt: string; due: number; period: number; status: string; result: string | null; last_run: number | null };
const states: Record<string, string> = { pending: '等待执行', running: '执行中', completed: '已完成', failed: '失败', cancelled: '已取消' };

export default function ScheduledPanel() {
  const { baseUrl } = useWebSocket();
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/scheduled-tasks`;
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(endpoint, { signal });
      if (!response.ok) throw new Error('无法加载定时任务');
      setJobs(await response.json());
    } catch (failure) {
      if (!signal?.aborted) setError(String(failure));
    }
  }, [endpoint]);
  useEffect(() => {
    const request = new AbortController();
    void refresh(request.signal);
    const timer = window.setInterval(() => void refresh(request.signal), 3000);
    return () => { request.abort(); window.clearInterval(timer); };
  }, [refresh]);
  async function post(path: string, input?: object) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(endpoint + path, {
        method: 'POST',
        headers: input ? { 'Content-Type': 'application/json' } : undefined,
        body: input ? JSON.stringify(input) : undefined,
      });
      if (!response.ok) throw new Error('操作失败，请检查任务时间或状态');
      if (input) setEditing(false);
      await refresh();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setBusy(false);
    }
  }

  return <Box>
    <Button size="sm" mb={3} onClick={() => setEditing((value) => !value)}>{editing ? '关闭表单' : '＋ 新建任务'}</Button>
    {editing && <Box mb={4} className="vt-inspector-form" asChild><form onSubmit={(event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const seconds = Math.ceil((new Date(String(fields.get('when'))).getTime() - Date.now()) / 1000);
      if (!Number.isFinite(seconds) || seconds < 1) { setError('请选择未来的执行时间'); return; }
      void post('', { title: fields.get('title'), prompt: fields.get('prompt'), seconds, repeat: fields.has('repeat') });
    }}>
      <label>任务名称<Input name="title" required maxLength={160} mb={2} /></label>
      <label>任务指令<Textarea name="prompt" required maxLength={4000} mb={2} placeholder="例如：生成一份每日复盘提纲" /></label>
      <label>首次执行时间（本地）<Input type="datetime-local" name="when" required mb={2} /></label>
      <Box mb={2}><label><input type="checkbox" name="repeat" /> 每天执行</label></Box>
      <Button type="submit" size="sm" disabled={busy}>保存任务</Button>
    </form></Box>}
    {error && <Text role="alert" color="red.400">{error}</Text>}
    {!jobs.length && !error && <Text color="var(--vt-muted)">暂无定时任务</Text>}
    {jobs.map((job) => <Box key={job.id} py={3} borderBottom="1px solid var(--vt-border)">
      <Text fontWeight="semibold" overflowWrap="anywhere">{job.title}</Text>
      <Text fontSize="xs" color="var(--vt-muted)">
        {states[job.status] || job.status} · {job.period ? '每天' : '一次'}
        {job.status === 'pending' && ` · ${new Date(job.due * 1000).toLocaleString()}`}
      </Text>
      <Box as="details" my={2}>
        <summary>查看指令与结果</summary>
        <Text whiteSpace="pre-wrap" overflowWrap="anywhere" fontSize="sm">{job.prompt}</Text>
        {job.result && <Box mt={2} p={2} bg="whiteAlpha.100" whiteSpace="pre-wrap" overflowWrap="anywhere" maxH="14rem" overflow="auto">{job.result}</Box>}
      </Box>
      {job.status === 'pending' && <Button size="xs" disabled={busy} onClick={() => void post(`/${job.id}/cancel`)}>取消任务</Button>}
    </Box>)}
  </Box>;
}
