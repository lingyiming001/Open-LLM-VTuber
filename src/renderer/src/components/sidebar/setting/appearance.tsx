import { Box, Button, Text } from '@chakra-ui/react';
import { FiMoon, FiSun, FiMonitor, FiCheck } from 'react-icons/fi';
import { useEffect, useRef } from 'react';
import { accents, useAppearance } from '@/context/appearance-context';

type Props = { onSave: (callback: () => void) => () => void; onCancel: (callback: () => void) => () => void };
export default function Appearance({ onSave, onCancel }: Props) {
  const { appearance, setAppearance } = useAppearance();
  const original = useRef(appearance);
  const current = useRef(appearance);
  current.current = appearance;
  useEffect(() => onSave(() => { original.current = current.current; }), [onSave]);
  useEffect(() => onCancel(() => setAppearance(original.current)), [onCancel, setAppearance]);
  return <Box>
    <Text fontWeight="medium" mb={2}>界面主题</Text>
    <Text fontSize="sm" color="var(--vt-muted)" mb={5}>即时预览，保存后保留设置；取消可恢复。</Text>
    <Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={3}>
      {([{ value: 'dark', label: '深色', icon: FiMoon }, { value: 'light', label: '浅色', icon: FiSun }, { value: 'system', label: '跟随系统', icon: FiMonitor }] as const).map(({ value, label, icon: Icon }) => <Button key={value} aria-pressed={appearance.mode === value} height="100px" flexDirection="column" gap={3} bg="var(--vt-raised)" color="var(--vt-text)" border="2px solid" borderColor={appearance.mode === value ? 'var(--vt-accent)' : 'var(--vt-border)'} onClick={() => setAppearance({ ...appearance, mode: value })}><Icon size={24} />{label}</Button>)}
    </Box>
    <Text fontWeight="medium" mt={8} mb={4}>强调色</Text>
    <Box display="flex" gap={3}>{accents.map((accent, index) => <Button key={accent} aria-label={['鸢尾紫', '天空蓝', '翡翠绿', '琥珀金', '玫瑰粉'][index]} aria-pressed={appearance.accent === accent} minW="40px" width="40px" height="40px" p={0} borderRadius="full" bg={accent} color="white" onClick={() => setAppearance({ ...appearance, accent })}>{appearance.accent === accent && <FiCheck />}</Button>)}</Box>
    <Box mt={8} p={5} borderRadius="xl" border="1px solid var(--vt-border)" bg="var(--vt-raised)"><Text fontWeight="medium">主题预览</Text><Text color="var(--vt-muted)" fontSize="sm" mt={2}>设置、资源库、扩展和播放器将使用同一主题。</Text><Button mt={4} bg="var(--vt-accent)" color="white" tabIndex={-1}>强调色效果</Button></Box>
  </Box>;
}
