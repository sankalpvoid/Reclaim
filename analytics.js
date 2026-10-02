import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const STATE_KEY = 'reclaim-state-v2';
const SESSION_KEY = 'reclaim-session-v1';
const ANON_KEY = 'reclaim-analytics-id-v1';
const BROWSER_SESSION_KEY = 'reclaim-analytics-session-v1';
const LAST_SESSION_KEY = 'reclaim-analytics-last-session-v1';
const ONBOARDING_STARTED_KEY = 'reclaim-analytics-onboarding-started-v1';
const ONBOARDING_KEY = 'reclaim-analytics-onboarding-complete-v1';
const EVENT_NAMES = new Set([
  'session_started', 'returning_session', 'onboarding_started',
  'onboarding_completed', 'journey_mode_selected', 'home_viewed',
  'cigarette_logged', 'trigger_captured', 'craving_logged',
  'craving_support_opened', 'support_tool_started',
  'support_tool_completed', 'tool_feedback', 'insights_viewed',
  'community_viewed', 'community_engaged', 'screen_viewed',
  'quick_checkin_opened', 'checkin_completed', 'plan_editor_opened',
  'plan_saved', 'auth_started', 'auth_submitted',
  'insight_period_changed', 'momentum_tab_viewed',
  'dream_goal_started', 'dream_goal_created', 'dream_goal_delete_started',
  'community_story_shared', 'community_reply_shared', 'setback_logged',
  'session_summary', 'for_you_opened', 'for_you_action', 'client_error'
]);
const SAFE_PROPERTY_KEYS = new Set([
  'tool', 'feedback', 'resisted', 'engagement', 'trigger_category', 'source',
  'screen', 'outcome', 'auth_action', 'period', 'tab', 'entry_stage',
  'duration_seconds', 'screens_seen', 'meaningful_actions', 'action',
  'error_kind', 'error_name', 'error_source', 'error_fingerprint'
]);
const VALID_MODES = new Set(['quit', 'reduce', 'track']);
const VALID_TOOLS = new Set(['breathe', 'timer', 'water', 'walk']);
const VALID_FEEDBACK = new Set(['yes', 'a_little', 'not_really', 'skipped']);
const VALID_ERROR_KINDS = new Set(['window_error', 'unhandled_rejection']);
const VALID_SCREENS = new Set([
  'intro', 'auth', 'setup', 'mood', 'support', 'home', 'health',
  'momentum', 'dreams', 'more', 'insights', 'circles', 'craving'
]);
const NUMERIC_PROPERTY_KEYS = new Set([
  'duration_seconds', 'screens_seen', 'meaningful_actions'
]);
const ERROR_PROPERTY_KEYS = new Set([
  'error_name', 'error_source', 'error_fingerprint'
]);
const debug = new URLSearchParams(location.search).has('analytics-debug');
const disabled = new URLSearchParams(location.search).has('analytics-disabled');
const local = ['localhost', '127.0.0.1'].includes(location.hostname);
const OPT_OUT_KEY = 'reclaim-analytics-optout-v1';
function optedOut() {
  try { if (localStorage.getItem(OPT_OUT_KEY) === '1') return true; } catch {}
  return navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true;
}

function storedJson(key, storage = localStorage) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
}

function stableId(key, storage) {
  let value = storage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    storage.setItem(key, value);
  }
  return value;
}

const anonymousId = stableId(ANON_KEY, localStorage);
const browserSessionId = stableId(BROWSER_SESSION_KEY, sessionStorage);
const previousSessionId = localStorage.getItem(LAST_SESSION_KEY);
localStorage.setItem(LAST_SESSION_KEY, browserSessionId);

function currentState() {
  return storedJson(STATE_KEY) || {};
}

function journeyMode(state = currentState()) {
  const mode = state?.profile?.journeyMode;
  return VALID_MODES.has(mode) ? mode : null;
}

function authContext() {
  const auth = storedJson(SESSION_KEY);
  return {
    token: auth?.access_token || null,
    userId: auth?.user?.id || null
  };
}

function safeProperties(properties = {}) {
  const result = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!SAFE_PROPERTY_KEYS.has(key)) continue;
    if (key === 'tool' && !VALID_TOOLS.has(value)) continue;
    if (key === 'feedback' && !VALID_FEEDBACK.has(value)) continue;
    if (key === 'resisted' && typeof value !== 'boolean') continue;
    if (key === 'screen' && !VALID_SCREENS.has(value)) continue;
    if (key === 'error_kind' && !VALID_ERROR_KINDS.has(value)) continue;
    if (ERROR_PROPERTY_KEYS.has(key)) {
      if (typeof value === 'string' && /^[A-Za-z0-9._:-]{1,48}$/.test(value)) result[key] = value;
      continue;
    }
    if (NUMERIC_PROPERTY_KEYS.has(key) && Number.isInteger(value) && value >= 0) {
      result[key] = Math.min(value, 86400);
      continue;
    }
    if (typeof value === 'string' && value.length <= 48) result[key] = value;
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

function track(eventName, properties = {}, modeOverride = null) {
  if (disabled || optedOut() || !EVENT_NAMES.has(eventName) || (local && !debug)) return;
  const { token, userId } = authContext();
  const payload = {
    anonymous_id: anonymousId,
    session_id: browserSessionId,
    user_id: userId,
    event_name: eventName,
    journey_mode: VALID_MODES.has(modeOverride) ? modeOverride : journeyMode(),
    properties: safeProperties(properties),
    client_created_at: new Date().toISOString()
  };
  if (debug) {
    console.info('[Reclaim analytics]', JSON.stringify(payload));
    if (local) return;
  }
  fetch(`${SUPABASE_URL}/rest/v1/analytics_events`, {
    method: 'POST',
    keepalive: true,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function safeErrorName(value) {
  const cleaned = String(value || 'Error').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 48);
  return cleaned || 'Error';
}

function safeErrorSource(value) {
  if (typeof value === 'string' && /^[A-Za-z0-9._-]{1,48}$/.test(value)) return value;
  try {
    const url = new URL(value || location.href, location.href);
    if (url.origin !== location.origin) return 'external';
    const filename = url.pathname.split('/').filter(Boolean).pop() || 'document';
    return /^[A-Za-z0-9._-]{1,48}$/.test(filename) ? filename : 'app';
  } catch {
    return 'unknown';
  }
}

async function errorFingerprint(value) {
  try {
    const input = new TextEncoder().encode(String(value).slice(0, 4096));
    const digest = await crypto.subtle.digest('SHA-256', input);
    return [...new Uint8Array(digest)].slice(0, 8).map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return 'unavailable';
  }
}

const reportedClientErrors = new Set();
async function reportClientError(kind, reason, source = '') {
  if (!VALID_ERROR_KINDS.has(kind) || reportedClientErrors.size >= 8) return;
  const error = reason instanceof Error ? reason : null;
  const name = safeErrorName(error?.name || reason?.name || 'Error');
  const message = error?.message || (typeof reason === 'string' ? reason : '');
  const stack = typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 3).join('|') : '';
  const errorSource = safeErrorSource(source);
  const fingerprint = await errorFingerprint(`${kind}|${name}|${message}|${stack}|${errorSource}`);
  if (reportedClientErrors.has(fingerprint)) return;
  reportedClientErrors.add(fingerprint);
  const state = currentState();
  const screen = state.stage === 'app' ? state.view || 'home' : state.stage || 'intro';
  track('client_error', {
    error_kind: kind,
    error_name: name,
    error_source: errorSource,
    error_fingerprint: fingerprint,
    screen
  });
}

window.addEventListener('error', event => {
  void reportClientError('window_error', event.error || event.message, event.filename || 'document');
});

window.addEventListener('unhandledrejection', event => {
  void reportClientError('unhandled_rejection', event.reason, 'promise');
});

track('session_started');
if (previousSessionId && previousSessionId !== browserSessionId) track('returning_session');

let activeTool = null;
const sessionStartedAt = Date.now();
const screensSeen = new Set();
let meaningfulActions = 0;
let previousCravingCount = Array.isArray(currentState().cravings) ? currentState().cravings.length : 0;
let lastScreen = '';

function observeState() {
  const state = currentState();
  const cravings = Array.isArray(state.cravings) ? state.cravings : [];
  if (cravings.length > previousCravingCount) {
    for (const craving of cravings.slice(previousCravingCount)) {
      if (craving?.resisted && VALID_TOOLS.has(craving?.tool)) {
        track('support_tool_completed', { tool: craving.tool });
      }
      track('craving_logged', {
        resisted: Boolean(craving?.resisted),
        tool: VALID_TOOLS.has(craving?.tool) ? craving.tool : undefined
      });
    }
  }
  previousCravingCount = cravings.length;

  if (state.stage === 'app'
    && localStorage.getItem(ONBOARDING_STARTED_KEY) === 'true'
    && localStorage.getItem(ONBOARDING_KEY) !== 'true') {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    track('onboarding_completed');
  }

  const screen = state.stage === 'app' ? state.view || 'home' : state.stage || 'intro';
  if (screen === lastScreen) return;
  lastScreen = screen;
  screensSeen.add(screen);
  track('screen_viewed', { screen });
  if (screen === 'home') track('home_viewed');
  if (screen === 'insights') track('insights_viewed');
  if (screen === 'circles') track('community_viewed');
  if (screen === 'craving') track('craving_support_opened');
}

document.addEventListener('click', event => {
  const element = event.target.closest('button, [data-tool], [data-view]');
  if (!element) return;

  if (element.matches('[data-stage]') && element.textContent.includes('BEGIN JOURNEY')) {
    localStorage.setItem(ONBOARDING_STARTED_KEY, 'true');
    track('onboarding_started');
  }
  if (element.matches('[data-journey-mode]')) {
    track('journey_mode_selected', {}, element.dataset.journeyMode);
  }
  if (element.matches('[data-log-cigarette]')) track('cigarette_logged');
  if (element.matches('[data-tool]')) {
    activeTool = element.dataset.tool;
    track('support_tool_started', { tool: activeTool });
  }
  if (element.matches('[data-craving-feedback]')) {
    track('tool_feedback', { tool: activeTool, feedback: element.dataset.cravingFeedback });
  }
  if (element.matches('[data-feedback-skip]')) {
    track('tool_feedback', { tool: activeTool, feedback: 'skipped' });
  }

  const trigger = element.closest('[data-cigarette-trigger], [data-trigger]');
  if (trigger) {
    const category = trigger.dataset.cigaretteTrigger || trigger.dataset.trigger;
    track('trigger_captured', { trigger_category: category });
  }

  const engagement = element.matches('[data-share-story]') ? 'share_started'
    : element.matches('[data-cheer]') ? 'cheer'
    : element.matches('[data-open-thread]') ? 'thread_opened'
    : element.matches('[data-save-post]') ? 'post_saved'
    : element.matches('[data-community-filter]') ? 'filter_changed'
    : element.matches('[data-community-stage]') ? 'stage_changed'
    : element.matches('[data-community-view]') ? 'view_changed'
    : element.matches('[data-complete-challenge]') ? 'challenge_completed'
    : null;
  if (engagement) track('community_engaged', { engagement });

  if (element.matches('[data-for-you]')) track('for_you_opened');
  if (element.matches('[data-for-you-action]')) track('for_you_action', { action: element.dataset.forYouAction });
  if (element.matches('[data-mood], [data-quick-mood]')) {
    const mood = element.dataset.mood || element.dataset.quickMood;
    const outcome = mood === 'struggling' ? 'support' : mood === 'craving' ? 'craving_support' : 'home';
    track('checkin_completed', { outcome });
  }
  if (element.matches('[data-edit-profile]')) track('plan_editor_opened');
  if (element.matches('[data-open-auth], [data-auth], [data-google]')) {
    const authAction = element.dataset.openAuth || element.dataset.auth || (element.matches('[data-google]') ? 'google' : 'unknown');
    track('auth_started', { auth_action: authAction });
  }
  if (element.matches('[data-insight-period]')) track('insight_period_changed', { period: element.dataset.insightPeriod });
  if (element.matches('[data-momentum-tab]')) track('momentum_tab_viewed', { tab: element.dataset.momentumTab });
  if (element.matches('[data-add-goal]')) track('dream_goal_started');
  if (element.matches('[data-delete-goal]')) track('dream_goal_delete_started');

  if (element.matches('[data-log-cigarette], [data-tool], [data-craving-feedback], [data-share-story], [data-cheer], [data-save-post], [data-log-setback]')) {
    meaningfulActions += 1;
  }
}, true);

document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === 'setup-form') track('plan_saved');
  if (form.id === 'auth-form') track('auth_submitted', { auth_action: currentState()?.authMode || 'unknown' });
  if (form.id === 'goal-form') track('dream_goal_created');
  if (form.id === 'community-form') track('community_story_shared');
  if (form.id === 'reply-form') track('community_reply_shared');
  if (form.id === 'setback-form') track('setback_logged');
  if (['setup-form', 'goal-form', 'community-form', 'reply-form', 'setback-form'].includes(form.id)) meaningfulActions += 1;
}, true);

window.addEventListener('pagehide', () => {
  track('session_summary', {
    entry_stage: currentState()?.stage || 'unknown',
    duration_seconds: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)),
    screens_seen: screensSeen.size,
    meaningful_actions: meaningfulActions
  });
});

const app = document.querySelector('#app');
if (app) new MutationObserver(observeState).observe(app, { childList: true, subtree: true });
observeState();
