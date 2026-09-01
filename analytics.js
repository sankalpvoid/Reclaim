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
  'community_viewed', 'community_engaged'
]);
const SAFE_PROPERTY_KEYS = new Set([
  'tool', 'feedback', 'resisted', 'engagement', 'trigger_category', 'source'
]);
const VALID_MODES = new Set(['quit', 'reduce', 'track']);
const VALID_TOOLS = new Set(['breathe', 'timer', 'water', 'walk']);
const VALID_FEEDBACK = new Set(['yes', 'a_little', 'not_really', 'skipped']);
const debug = new URLSearchParams(location.search).has('analytics-debug');
const local = ['localhost', '127.0.0.1'].includes(location.hostname);

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
    if (typeof value === 'string' && value.length <= 48) result[key] = value;
    if (typeof value === 'boolean') result[key] = value;
  }
  return result;
}

function track(eventName, properties = {}, modeOverride = null) {
  if (!EVENT_NAMES.has(eventName) || (local && !debug)) return;
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

track('session_started');
if (previousSessionId && previousSessionId !== browserSessionId) track('returning_session');

let activeTool = null;
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
}, true);

const app = document.querySelector('#app');
if (app) new MutationObserver(observeState).observe(app, { childList: true, subtree: true });
observeState();
