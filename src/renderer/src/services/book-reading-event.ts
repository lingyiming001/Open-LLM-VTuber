type ToolStatus = { type: string; tool_name?: string; status?: string; content?: string };

/** Use the real bookshelf result, including servers without layout metadata. */
export function getBookReadingEvent(message: ToolStatus) {
  if (message.type !== 'tool_call_status' || message.tool_name !== 'local_bookshelf' || message.status !== 'completed') return null;
  try {
    const result = JSON.parse(message.content || '');
    if (typeof result.book !== 'string' || !Array.isArray(result.passages) || !result.passages.length || !Number.isInteger(result.start) || result.start < 0) return null;
    return { path: result.book, start: result.start, external: true };
  } catch { return null; }
}
