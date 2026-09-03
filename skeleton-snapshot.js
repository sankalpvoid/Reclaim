const SNAPSHOT_KEY = 'reclaim-page-skeleton-v1';
const STATE_KEY = 'reclaim-state-v2';
const SESSION_KEY = 'reclaim-session-v1';
const ROUTE_TRANSITION_KEY = 'reclaim-route-transition-v1';

function parse(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch { return fallback; }
}

function routeTransitionActive() {
  try { return Boolean(sessionStorage.getItem(ROUTE_TRANSITION_KEY)); }
  catch { return false; }
}

function currentUserId() {
  const session = parse(SESSION_KEY, {});
  return session?.user?.id || session?.user_id || session?.id || null;
}

function hasVisibleBackground(style) {
  const color = style?.backgroundColor || '';
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
    const alpha = parts.length > 3 ? parts[3] : 1;
    if (alpha > 0.025) return true;
  }
  return Boolean(style?.backgroundImage && style.backgroundImage !== 'none');
}

function hasVisibleBorder(style) {
  if (!style) return false;
  return ['Top', 'Right', 'Bottom', 'Left'].some((side) => {
    const width = Number.parseFloat(style[`border${side}Width`] || '0');
    const borderStyle = style[`border${side}Style`];
    return width > 0 && borderStyle && borderStyle !== 'none';
  });
}

function tagStructuralSurfaces(root, clone) {
  const originals = [root, ...root.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];

  copies.forEach((copy, index) => {
    const source = originals[index];
    if (!source || !copy || source === root) return;
    const style = getComputedStyle(source);
    if (hasVisibleBackground(style) || hasVisibleBorder(style)) {
      copy.setAttribute('data-skeleton-surface', '');
    }
  });
}

function prepareClone(root) {
  const clone = root.cloneNode(true);
  tagStructuralSurfaces(root, clone);

  clone.querySelectorAll('.toast,.modal,.boot-shell,.reclaim-snapshot-host,[data-snapshot-ignore]').forEach((el) => el.remove());

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

  clone.querySelectorAll([
    '.progress > span',
    '[class*="progress"] > span',
    '[class*="progress"] [class*="fill"]',
    '[class*="meter"] [class*="fill"]',
    '[role="progressbar"] > *',
  ].join(',')).forEach((el) => {
    el.setAttribute('data-skeleton-progress-fill', '');
    el.style.setProperty('opacity', '0', 'important');
    el.style.setProperty('background', 'transparent', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
  });

  const glassStyle = document.createElement('style');
  glassStyle.setAttribute('data-snapshot-style', 'glass');
  glassStyle.textContent = `
    .reclaim-snapshot {
      filter: none !important;
    }
    .reclaim-snapshot * {
      background-image: none !important;
      text-shadow: none !important;
    }
    .reclaim-snapshot [data-skeleton-surface] {
      background: rgba(255,255,255,.018) !important;
      border-color: rgba(185,158,255,.30) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.05),
        inset 0 0 26px rgba(139,92,246,.085),
        0 0 18px rgba(139,92,246,.045),
        0 10px 26px rgba(0,0,0,.08) !important;
      -webkit-backdrop-filter: blur(12px) saturate(.9) !important;
      backdrop-filter: blur(12px) saturate(.9) !important;
    }
    html[data-theme="light"] .reclaim-snapshot [data-skeleton-surface] {
      background: rgba(255,255,255,.25) !important;
      border-color: rgba(126,96,210,.24) !important;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.62),
        inset 0 0 24px rgba(139,92,246,.065),
        0 0 16px rgba(139,92,246,.035),
        0 10px 26px rgba(55,45,70,.03) !important;
    }
    .reclaim-snapshot::after {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(196,181,253,.018) 24%,
        rgba(196,181,253,.10) 40%,
        rgba(221,214,254,.25) 50%,
        rgba(196,181,253,.10) 60%,
        rgba(196,181,253,.018) 76%,
        transparent 100%
      ) !important;
    }
    html[data-theme="light"] .reclaim-snapshot::after {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(124,92,210,.015) 24%,
        rgba(124,92,210,.075) 40%,
        rgba(139,92,246,.16) 50%,
        rgba(124,92,210,.075) 60%,
        rgba(124,92,210,.015) 76%,
        transparent 100%
      ) !important;
    }
    .reclaim-snapshot [data-skeleton-progress-fill],
    .reclaim-snapshot .progress > span,
    .reclaim-snapshot [class*="progress"] > span,
    .reclaim-snapshot [class*="progress"] [class*="fill"],
    .reclaim-snapshot [class*="meter"] [class*="fill"],
    .reclaim-snapshot [role="progressbar"] > * {
      opacity: 0 !important;
      background: transparent !important;
      border-color: transparent !important;
      box-shadow: none !important;
    }
  `;
  clone.prepend(glassStyle);

  clone.querySelectorAll('script').forEach((el) => el.remove());
  return clone;
}

function saveSnapshot() {
  // During a deliberate route reload the saved state may already describe the destination
  // while the DOM still describes the source screen. Never persist that mismatched geometry.
  if (routeTransitionActive()) return;

  const app = document.getElementById('app');
  if (!app || app.querySelector('.boot-shell,.reclaim-snapshot-host')) return;
  const shell = app.querySelector('.shell') || app.firstElementChild;
  if (!shell) return;

  const state = parse(STATE_KEY, {});
  const clone = prepareClone(shell);
  const html = clone.outerHTML;

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
