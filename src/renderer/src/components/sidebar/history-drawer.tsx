import { Box, Button, Input, Text, Flex } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DrawerRoot,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerActionTrigger,
  DrawerBackdrop,
  DrawerCloseTrigger,
} from '@/components/ui/drawer';
import { sidebarStyles } from './sidebar-styles';
import { useHistoryDrawer } from '@/hooks/sidebar/use-history-drawer';
import { HistoryInfo } from '@/context/websocket-context';

// Type definitions
interface HistoryDrawerProps {
  children: React.ReactNode;
}

interface HistoryItemProps {
  isSelected: boolean;
  latestMessage: { content: string; timestamp: string | null };
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  isDeleteDisabled: boolean;
}

// Reusable components
const HistoryItem = memo(({
  isSelected,
  latestMessage,
  onSelect,
  onDelete,
  isDeleteDisabled,
}: HistoryItemProps): JSX.Element => {
  const { t } = useTranslation();
  return (
    <Box
      className="vt-history-row"
      {...sidebarStyles.historyDrawer.historyItem}
      {...(isSelected ? sidebarStyles.historyDrawer.historyItemSelected : {})}
    >
      <Box {...sidebarStyles.historyDrawer.historyHeader}>
        <Button variant="ghost" size="sm" onClick={onSelect} aria-current={isSelected ? "true" : undefined}>
          {latestMessage.timestamp
            ? formatDistanceToNow(new Date(latestMessage.timestamp), { addSuffix: true })
            : t('history.noMessages')}
        </Button>
        <Button
          aria-label="删除此会话"
          onClick={onDelete}
          disabled={isDeleteDisabled}
          {...sidebarStyles.historyDrawer.deleteButton}
        >
          <FiTrash2 />
        </Button>
      </Box>
      {latestMessage.content && (
        <Box {...sidebarStyles.historyDrawer.messagePreview} lineClamp={2}>
          {latestMessage.content}
        </Box>
      )}
    </Box>
  );
});

HistoryItem.displayName = 'HistoryItem';

// Main component
function HistoryDrawer({ children }: HistoryDrawerProps): JSX.Element {
  const { t } = useTranslation();
  const {
    open,
    setOpen,
    historyList,
    currentHistoryUid,
    fetchAndSetHistory,
    deleteHistory,
    getLatestMessageContent,
    canClear,
    clearHistory,
  } = useHistoryDrawer();

  const [query, setQuery] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    const done = () => setClearing(false);
    window.addEventListener('vt-history-clear-finished', done);
    return () => window.removeEventListener('vt-history-clear-finished', done);
  }, []);
  useEffect(() => { if (!canClear) setClearing(false); }, [canClear]);
  const visible = historyList.filter((history) => {
    const { content } = getLatestMessageContent(history);
    return (showEmpty || content || history.uid === currentHistoryUid)
      && content.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <DrawerRoot
      open={open}
      onOpenChange={(e) => { setOpen(e.open); if (!e.open) setConfirm(false); }}
      placement="start"
    >
      <DrawerBackdrop />
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent className="vt-inspector vt-inspector--history" style={sidebarStyles.historyDrawer.drawer.content}>
        <DrawerHeader>
          <DrawerTitle style={sidebarStyles.historyDrawer.drawer.title}>
            {t('history.chatHistoryList')}
          </DrawerTitle>
          <DrawerCloseTrigger style={sidebarStyles.historyDrawer.drawer.closeButton} />
        </DrawerHeader>

        <DrawerBody>
          <Input aria-label="搜索最近消息" placeholder="搜索最近消息" value={query} onChange={(event) => setQuery(event.target.value)} mb={2} />
          <Flex className="vt-inspector-actions" justify="space-between" align="center" gap={2} mb={3}>
            <label><input type="checkbox" checked={showEmpty} onChange={(event) => setShowEmpty(event.target.checked)} /> 显示空会话</label>
            <Button size="sm" variant="outline" colorPalette="red" disabled={!canClear || clearing || historyList.length === 0} onClick={() => setConfirm(true)}>{clearing ? '正在清空…' : '清空全部'}</Button>
          </Flex>
          {confirm && <Box p={3} mb={3} borderWidth="1px" borderRadius="md" role="group" aria-label="确认清空聊天历史">
            <Text fontSize="sm" mb={2}>永久删除当前角色的全部聊天历史，并打开一个新会话。</Text>
            <Flex gap={2}>
              <Button size="sm" onClick={() => setConfirm(false)}>取消</Button>
              <Button size="sm" colorPalette="red" disabled={!canClear} onClick={() => { setConfirm(false); setClearing(true); clearHistory(); }}>确认清空</Button>
            </Flex>
          </Box>}
          {!visible.length && <Text color="var(--vt-muted)" py={4}>{query.trim() ? '没有匹配的会话' : '暂无会话'}</Text>}
          <Box className="vt-inspector-list" {...sidebarStyles.historyDrawer.listContainer}>
            {visible.map((history: HistoryInfo) => (
              <HistoryItem
                key={history.uid}
                isSelected={currentHistoryUid === history.uid}
                latestMessage={getLatestMessageContent(history)}
                onSelect={() => fetchAndSetHistory(history.uid)}
                onDelete={(e) => {
                  e.stopPropagation();
                  deleteHistory(history.uid);
                }}
                isDeleteDisabled={currentHistoryUid === history.uid}
              />
            ))}
          </Box>
        </DrawerBody>

        <DrawerFooter>
          <DrawerActionTrigger asChild>
            <Button {...sidebarStyles.historyDrawer.drawer.actionButton}>
              {t('common.close')}
            </Button>
          </DrawerActionTrigger>
        </DrawerFooter>
      </DrawerContent>
    </DrawerRoot>
  );
}

export default HistoryDrawer;
