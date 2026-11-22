import { describe, expect, it } from 'vitest';
import { getBookReadingEvent } from '../book-reading-event';

describe('bookshelf reading notification', () => {
  it('opens the read book even without stage_action metadata', () => {
    expect(getBookReadingEvent({ type: 'tool_call_status', tool_name: 'local_bookshelf', status: 'completed', content: JSON.stringify({ book: '白居易诗全集.epub', start: 12, passages: ['诗歌正文'] }) })).toEqual({ path: '白居易诗全集.epub', start: 12, external: true });
  });
  it('does not switch for catalog, search, failed reads or malformed results', () => {
    for (const content of ['{"books":["a.epub"]}', '{"matches":[]}', '{"book":"a.epub","start":0,"passages":[]}', 'error']) {
      expect(getBookReadingEvent({ type: 'tool_call_status', tool_name: 'local_bookshelf', status: 'completed', content })).toBeNull();
    }
  });
});
