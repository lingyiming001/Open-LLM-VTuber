/** Never restart the current file when the user asks for another item. */
export function nextMediaPath(items: { path: string }[], current: string, delta = 1): string | null {
  const paths = [...new Set(items.map((item) => item.path))];
  if (!paths.some((path) => path !== current)) return null;
  const index = paths.indexOf(current);
  if (index < 0) return delta < 0 ? paths[paths.length - 1] : paths[0];
  return paths[(index + (delta < 0 ? -1 : 1) + paths.length) % paths.length];
}
