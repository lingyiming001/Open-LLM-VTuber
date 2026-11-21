import { useEffect, useState } from 'react';
import { Button, Box } from '@chakra-ui/react';
import { FiSquare } from 'react-icons/fi';
import { useWebSocket } from '@/context/websocket-context';

export default function ControlStop() {
  const { baseUrl } = useWebSocket();
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');
  const api = `${baseUrl.replace(/\/$/, '')}/api/control`;
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const response = await fetch(api);
        if (!response.ok) return;
        const data = await response.json();
        if (alive) setEnabled(data.settings.computer || data.settings.browser);
      } catch { /* A disconnected backend cannot receive stop commands. */ }
    }
    void poll();
    const timer = window.setInterval(poll, 2000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [api]);
  if (!enabled && !error) return null;
  return <Box position="fixed" bottom="88px" right="20px" zIndex={1500}>
    {error && <Box role="alert" bg="var(--vt-surface)" color="red.400" p={2} fontSize="xs">{error}</Box>}
    <Button size="sm" colorPalette="red" onClick={async () => {
      try {
        const response = await fetch(`${api}/stop`, { method: 'POST' });
        if (!response.ok) throw new Error('停止失败，请检查后端连接');
        setEnabled(false); setError('');
      } catch { setError('无法连接后端，请手动停止后端进程'); }
    }}><FiSquare />停止电脑 / 浏览器操作</Button>
  </Box>;
}
