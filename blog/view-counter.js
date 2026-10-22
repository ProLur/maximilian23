const ENDPOINT = 'https://aula-del-futuro-reservas.mmartinezf001.workers.dev/blog-views';
const WINDOW_MS = 30 * 60 * 1000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
let memoryVisitor;

function visitorId() {
  try {
    const stored = localStorage.getItem('m23:visitor');
    if (UUID.test(stored || '')) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem('m23:visitor', id);
    return id;
  } catch { return memoryVisitor ||= crypto.randomUUID(); }
}

// Storage is only a convenience. The server also deduplicates atomically.
export async function recordPostView(blog, id) {
  const key = `m23:view:${blog}:${id}`;
  const record = async () => {
    try {
      const previous = Number(localStorage.getItem(key));
      if (previous > 0 && Date.now() - previous >= 0 && Date.now() - previous < WINDOW_MS) return;
    } catch { /* Privacy mode can disable storage. */ }
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blog, id, visitorId: visitorId() }),
        signal: AbortSignal.timeout(15000), credentials: 'omit'
      });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.ok !== true || !Number.isFinite(result.retryAfterMs)) throw Error('Respuesta no válida');
      // A failed request must remain retryable; never mark it before confirmation.
      try { localStorage.setItem(key, String(Date.now() - WINDOW_MS + Math.max(0, Math.min(WINDOW_MS, result.retryAfterMs)))); } catch {}
    } catch (error) { console.warn('No se ha podido registrar la visita:', error.message); }
  };
  try {
    return navigator.locks ? await navigator.locks.request(key, record) : await record();
  } catch (error) { console.warn('No se ha podido registrar la visita:', error.message); }
}
