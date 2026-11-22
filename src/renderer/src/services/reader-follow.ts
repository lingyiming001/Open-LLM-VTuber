export type ReaderChapter = { title: string; chunks: string[] };
const normalize = (text: string) => text.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();

/** Match spoken source text; commentary without a source quote leaves focus unchanged. */
export function locateSpokenPassage(chapters: ReaderChapter[], cue: string, fromChapter: number, fromPassage: number) {
  const spoken = normalize(cue);
  if (spoken.length < 6) return null;
  const candidates: { chapter: number; passage: number; distance: number }[] = [];
  for (let c = 0; c < chapters.length; c += 1) {
    for (let p = 0; p < chapters[c].chunks.length; p += 1) {
      const source = normalize(chapters[c].chunks[p]);
      let matches = source.includes(spoken) || (source.length >= 6 && spoken.includes(source));
      for (let i = 0; !matches && i <= spoken.length - 8; i += 1) matches = source.includes(spoken.slice(i, i + 8));
      if (matches) candidates.push({ chapter: c, passage: p, distance: Math.abs(c - fromChapter) * 100000 + Math.abs(p - Math.max(0, fromPassage)) });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] || null;
}
