import { describe, expect, it } from 'vitest';
import { locateSpokenPassage } from '../reader-follow';
const chapters = [{ title: '第一章', chunks: ['离离原上草，一岁一枯荣。', '野火烧不尽，春风吹又生。'] }, { title: '第二章', chunks: ['远芳侵古道，晴翠接荒城。'] }];
describe('reader follows the spoken source', () => {
  it('moves focus when the actual spoken cue advances', () => {
    expect(locateSpokenPassage(chapters, '野火烧不尽，春风吹又生。', 0, 0)).toMatchObject({ chapter: 0, passage: 1 });
  });
  it('turns chapters for a matching source passage', () => {
    expect(locateSpokenPassage(chapters, '远芳侵古道，晴翠接荒城。', 0, 1)).toMatchObject({ chapter: 1, passage: 0 });
  });
  it('ignores commentary and short ambiguous cues', () => {
    expect(locateSpokenPassage(chapters, '这首诗表达了诗人的思想感情。', 0, 0)).toBeNull();
    expect(locateSpokenPassage(chapters, '春风', 0, 0)).toBeNull();
  });
  it('matches a quote surrounded by narration', () => {
    expect(locateSpokenPassage(chapters, '接下来是：野火烧不尽，春风吹又生。', 0, 0)).toMatchObject({ chapter: 0, passage: 1 });
  });
});
