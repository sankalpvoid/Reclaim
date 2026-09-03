const SNAPSHOT_KEY = 'reclaim-page-skeleton-v1';
const STATE_KEY = 'reclaim-state-v2';
const SESSION_KEY = 'reclaim-session-v1';

function parse(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function currentUserId() {
  const session = parse(SESSION_KEY, {});
  return session?.user?.id || session?.user_id || session?.id || null;
}

function prepareClone(root) {
  const clone = root.cloneNode(true);

  // Never preserve transient overlays or the loader itself.
  clone.querySelectorAll('.toast,.modal,.boot-shell,.reclaim-snapshot-host,[data-snapshot-ignore]').forEach((el) => el.remove());

  // Keep geometry without persisting potentially huge or remote media payloads.
  const originals = root.querySelectorAll('img,video,iframe');
  const media = clone.querySelectorAll('img,video,iframe');
  media.forEach((el, index) => {
    const source = originals[index];
    const rect = source?.getBoundingClientRect?.();
    if (rect?.width) el.style.width = `${Math.round(rect.width)}px`;
    if (rect?.height) el.style.height = `${Math.round(rect.height)}px`;
    el.removeAttribute('src');
    el.removeAttribute('srcset');
    el.removeAttribute('poster');
    el.removeAttribute('loading');
  });

  clone.querySelectorAll('input,textarea').forEach((el) => {
    el.removeAttribute('value');
    el.removeAttribute('placeholder');
    if ('value' in el) el.value = '';
  });

  clone.querySelectorAll('[style]').forEach((el) => {
    if (el.style?.backgroundImage) el.style.backgroundImage = 'none';
  });

  clone.querySelectorAll('script').forEach((el) => el.remove());
  return clone;
}

function saveSnapshot() {
  const app = document.getElementById('app');
  if (!app || app.querySelector('.boot-shell,.reclaim-snapshot-host')) return;
  const shell = app.querySelector('.shell') || app.firstElementChild;
  if (!shell) return;

  const state = parse(STATE_KEY, {});
  const clone = prepareClone(shell);
  const html = clone.outerHTML;

  // Keep localStorage safe even if a future page becomes unexpectedly large.
  if (!html || html.length > 900_000) return;

  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      version: 1,
      userId: currentUserId(),
      stage: state?.stage || null,
      view: state?.view || null,
      capturedAt: Date.now(),
      html,
    }));
  } catch {
    // Snapshotting is a visual enhancement only; never affect the app itself.
  }
}

let timer = 0;
function scheduleSnapshot() {
  clearTimeout(timer);
  timer = window.setTimeout(saveSnapshot, 350);
}

const app = document.getElementById('app');
if (app) {
  const observer = new MutationObserver(scheduleSnapshot);
  observer.observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  scheduleSnapshot();
  window.addEventListener('pagehide', saveSnapshot);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSnapshot();
  });
}
