// Connection log shown in the lobby (and mirrored to the browser console),
// so players can copy it when something goes wrong.
export const logs = $state([]);

export function log(...parts) {
  const t = new Date();
  const stamp = t.toTimeString().slice(0, 8) + '.' + String(t.getMilliseconds()).padStart(3, '0');
  const line = `${stamp} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}`;
  logs.push(line);
  if (logs.length > 300) logs.shift();
  console.log('[certamen]', ...parts);
}

log(`app loaded · ${navigator.userAgent}`);
