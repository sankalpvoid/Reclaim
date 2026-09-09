const CONFIRMATION_STATUSES = new Set(['complete', 'smoke_free', 'untracked']);
const REVIEW_STATUSES = new Set(['collect_more_data', 'stable', 'mixed', 'struggling']);
const REVIEW_CHOICES = new Set(['continue', 'adjust', 'hold']);

function int(value, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeDate(value, fallback = '') {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : fallback;
}

function safeTargetHistory(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      const from = safeDate(item?.from);
      if (!from) return null;
      if (item?.target == null) return { from, target: null };
      return { from, target: int(item.target, 1, 1) };
    })
    .filter(Boolean);
}

function safeReviewHistory(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map(review => {
      const reviewedOn = safeDate(review?.reviewedOn);
      const from = safeDate(review?.from);
      if (!reviewedOn || !from || !REVIEW_STATUSES.has(review?.status)) return null;
      return {
        reviewedOn,
        from,
        target: int(review.target, 1, 1, 1000),
        nextTarget: int(review.nextTarget, 1, 1, 1000),
        status: review.status,
        loggedDays: int(review.loggedDays, 0, 0, 7),
        average: review.average == null ? null : finite(review.average, null),
        choice: REVIEW_CHOICES.has(review.choice) ? review.choice : 'continue'
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.reviewedOn.localeCompare(b.reviewedOn) || a.from.localeCompare(b.from));
}

export function emptyReductionSync() {
  return { planDirty: false, reviewsDirty: false, pendingReviews: [], confirmations: {} };
}

export function normalizeReductionSync(value = {}) {
  const confirmations = {};
  for (const [day, mutation] of Object.entries(value?.confirmations || {})) {
    if (!safeDate(day) || !mutation || !['upsert', 'delete'].includes(mutation.kind)) continue;
    if (mutation.kind === 'delete') confirmations[day] = { kind: 'delete' };
    else if (CONFIRMATION_STATUSES.has(mutation.status)) {
      confirmations[day] = {
        kind: 'upsert',
        status: mutation.status,
        recordedCount: int(mutation.recordedCount, 0, 0, 1000)
      };
    }
  }
  return {
    planDirty: Boolean(value?.planDirty),
    reviewsDirty: Boolean(value?.reviewsDirty),
    pendingReviews: safeReviewHistory(value?.pendingReviews),
    confirmations
  };
}

function syncFor(state) {
  state.reductionSync = normalizeReductionSync(state.reductionSync);
  return state.reductionSync;
}

export function markReductionPlanDirty(state, { reviews = false } = {}) {
  const sync = syncFor(state);
  sync.planDirty = true;
  if (reviews) {
    sync.reviewsDirty = true;
    const history = safeReviewHistory(state?.reductionPlan?.history);
    if (history.length) sync.pendingReviews = history;
  }
  return sync;
}

export function setDayConfirmation(state, day, status, recordedCount = 0) {
  const key = safeDate(day);
  if (!key || !CONFIRMATION_STATUSES.has(status)) return false;
  const count = status === 'smoke_free' ? 0 : int(recordedCount, 0, 0, 1000);
  state.dayConfirmations = { ...(state.dayConfirmations || {}), [key]: status };
  const sync = syncFor(state);
  sync.confirmations[key] = { kind: 'upsert', status, recordedCount: count };
  return true;
}

export function clearDayConfirmation(state, day) {
  const key = safeDate(day);
  if (!key) return false;
  const sync = syncFor(state);
  const hadLocal = Object.prototype.hasOwnProperty.call(state.dayConfirmations || {}, key);
  const pending = sync.confirmations[key];
  if (!hadLocal && !pending) return false;
  state.dayConfirmations = { ...(state.dayConfirmations || {}) };
  delete state.dayConfirmations[key];
  if (hadLocal || pending?.kind === 'upsert') sync.confirmations[key] = { kind: 'delete' };
  else delete sync.confirmations[key];
  return true;
}

export function planToRow(plan, userId) {
  if (!plan || !userId) return null;
  return {
    user_id: userId,
    version: int(plan.version, 1, 1, 32767),
    baseline: int(plan.baseline, 1, 1, 1000),
    baseline_source: String(plan.baselineSource || 'your estimate').slice(0, 80),
    current_target: int(plan.currentTarget, 1, 1, 1000),
    stage: int(plan.stage, 1, 1, 1000),
    status: ['active', 'paused', 'completed'].includes(plan.status) ? plan.status : 'active',
    started_on: safeDate(plan.startedOn),
    review_start: safeDate(plan.reviewStart),
    last_review_status: REVIEW_STATUSES.has(plan.lastReviewStatus) ? plan.lastReviewStatus : null,
    last_review: plan.lastReview && typeof plan.lastReview === 'object' ? plan.lastReview : null,
    target_history: safeTargetHistory(plan.targetHistory),
    minimum_automatic_target: int(plan.minimumAutomaticTarget, 1, 1, 1000),
    reduction_rate: Math.min(1, Math.max(0, finite(plan.reductionRate, 0.1))),
    review_window_days: int(plan.reviewWindowDays, 7, 1, 31),
    target_changed: Boolean(plan.targetChanged),
    updated_at: new Date().toISOString()
  };
}

export function reviewToRow(review, userId) {
  if (!review || !userId) return null;
  const reviewedOn = safeDate(review.reviewedOn);
  const reviewStart = safeDate(review.from);
  if (!reviewedOn || !reviewStart || !REVIEW_STATUSES.has(review.status)) return null;
  return {
    user_id: userId,
    reviewed_on: reviewedOn,
    review_start: reviewStart,
    target: int(review.target, 1, 1, 1000),
    next_target: int(review.nextTarget, 1, 1, 1000),
    status: review.status,
    logged_days: int(review.loggedDays, 0, 0, 7),
    average: review.average == null ? null : finite(review.average, null),
    choice: REVIEW_CHOICES.has(review.choice) ? review.choice : 'continue'
  };
}

export function planFromRow(row, reviewRows = []) {
  if (!row) return null;
  const history = (reviewRows || [])
    .map(review => ({
      reviewedOn: safeDate(review.reviewed_on),
      from: safeDate(review.review_start),
      target: int(review.target, 1, 1, 1000),
      nextTarget: int(review.next_target, 1, 1, 1000),
      status: REVIEW_STATUSES.has(review.status) ? review.status : 'mixed',
      loggedDays: int(review.logged_days, 0, 0, 7),
      average: review.average == null ? null : finite(review.average, null),
      choice: REVIEW_CHOICES.has(review.choice) ? review.choice : 'continue'
    }))
    .filter(review => review.reviewedOn && review.from)
    .sort((a, b) => a.reviewedOn.localeCompare(b.reviewedOn) || a.from.localeCompare(b.from));

  return {
    version: int(row.version, 1, 1, 32767),
    baseline: int(row.baseline, 1, 1, 1000),
    baselineSource: String(row.baseline_source || 'your estimate'),
    currentTarget: int(row.current_target, 1, 1, 1000),
    stage: int(row.stage, 1, 1, 1000),
    status: ['active', 'paused', 'completed'].includes(row.status) ? row.status : 'active',
    startedOn: safeDate(row.started_on),
    reviewStart: safeDate(row.review_start),
    lastReviewStatus: REVIEW_STATUSES.has(row.last_review_status) ? row.last_review_status : null,
    lastReview: row.last_review && typeof row.last_review === 'object' ? row.last_review : null,
    targetHistory: safeTargetHistory(row.target_history),
    minimumAutomaticTarget: int(row.minimum_automatic_target, 1, 1, 1000),
    reductionRate: Math.min(1, Math.max(0, finite(row.reduction_rate, 0.1))),
    reviewWindowDays: int(row.review_window_days, 7, 1, 31),
    targetChanged: Boolean(row.target_changed),
    history
  };
}

export function mergeCloudReductionPlan(state, cloudRow, cloudReviewRows = [], { reviewsUnavailable = false } = {}) {
  const sync = syncFor(state);
  const localPlan = state?.reductionPlan || null;
  if (!cloudRow) {
    if (!localPlan) return null;
    sync.planDirty = true;
    if (localPlan.history?.length) {
      sync.reviewsDirty = true;
      if (!sync.pendingReviews.length) sync.pendingReviews = safeReviewHistory(localPlan.history);
    }
    return localPlan;
  }

  // A fully pending local plan is newer than the last cloud snapshot.
  if (sync.planDirty && localPlan) return localPlan;

  const restored = planFromRow(cloudRow, cloudReviewRows);
  if (!restored) return localPlan;

  // Review history has its own durable pending snapshot. This keeps a review
  // recoverable if the plan upsert succeeds but the review-history upsert fails.
  if (sync.reviewsDirty) {
    const pending = sync.pendingReviews.length ? sync.pendingReviews : safeReviewHistory(localPlan?.history);
    if (pending.length) {
      restored.history = pending;
      sync.pendingReviews = pending;
    }
  } else if (reviewsUnavailable && localPlan?.history?.length) {
    restored.history = safeReviewHistory(localPlan.history);
  }
  return restored;
}

export function pendingReviewHistory(state) {
  const sync = syncFor(state);
  if (sync.pendingReviews.length) return sync.pendingReviews;
  return safeReviewHistory(state?.reductionPlan?.history);
}

export function clearPendingReviewHistory(state) {
  const sync = syncFor(state);
  sync.reviewsDirty = false;
  sync.pendingReviews = [];
  return sync;
}

export function confirmationMap(rows = []) {
  const result = {};
  for (const row of rows || []) {
    const day = safeDate(row?.day);
    if (day && CONFIRMATION_STATUSES.has(row?.status)) result[day] = row.status;
  }
  return result;
}

function recordedCountForDay(state, day) {
  return (state?.smokingEvents || [])
    .filter(event => {
      const date = new Date(event?.at);
      if (!Number.isFinite(+date)) return false;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return key === day;
    })
    .reduce((sum, event) => sum + int(event?.cigarettes, 0, 0, 1000), 0);
}

export function mergeCloudConfirmations(state, rows = []) {
  const cloud = confirmationMap(rows);
  const local = { ...(state.dayConfirmations || {}) };
  const sync = syncFor(state);
  const merged = { ...cloud };

  // One-time migration for confirmations created before cloud support existed.
  // Cloud wins when it already has a canonical row; local-only days are queued.
  for (const [day, status] of Object.entries(local)) {
    if (!safeDate(day) || !CONFIRMATION_STATUSES.has(status) || cloud[day] !== undefined || sync.confirmations[day]) continue;
    merged[day] = status;
    sync.confirmations[day] = {
      kind: 'upsert',
      status,
      recordedCount: status === 'smoke_free' ? 0 : recordedCountForDay(state, day)
    };
  }

  // Pending local writes always overlay the last cloud snapshot until acknowledged.
  for (const [day, mutation] of Object.entries(sync.confirmations)) {
    if (mutation.kind === 'delete') delete merged[day];
    else merged[day] = mutation.status;
  }

  return merged;
}

export function confirmationMutationToRow(day, mutation, userId) {
  const key = safeDate(day);
  if (!key || !userId || mutation?.kind !== 'upsert' || !CONFIRMATION_STATUSES.has(mutation.status)) return null;
  return {
    user_id: userId,
    day: key,
    status: mutation.status,
    recorded_count: mutation.status === 'smoke_free' ? 0 : int(mutation.recordedCount, 0, 0, 1000),
    updated_at: new Date().toISOString()
  };
}
