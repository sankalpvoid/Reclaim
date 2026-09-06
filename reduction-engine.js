// Reclaim v1 gradual-reduction engine.
// Pure functions only: no DOM, storage, network, or date side effects.

export const REDUCTION_RULES = Object.freeze({
  reviewWindowDays: 7,
  minimumLoggedDaysForReview: 4,
  defaultReductionRate: 0.10,
  minimumWeeklyDrop: 1,
  minimumAutomaticTarget: 1,
  stableSuccessRate: 0.70,
  strugglingSuccessRate: 0.40,
});

export function clampInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  const rounded = Number.isFinite(parsed) ? Math.round(parsed) : min;
  return Math.min(max, Math.max(min, rounded));
}

function validCounts(values = []) {
  return values
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0);
}

function mean(values = []) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

/**
 * Baseline priority:
 * 1. A real 7-day smoking history when enough logs exist.
 * 2. The user's onboarding estimate when history is still sparse.
 *
 * We intentionally do not blend both numbers. Once Reclaim has enough real
 * behaviour data, the observed average becomes the better baseline.
 */
export function calculateBaseline({ smokingLogs = [], onboardingEstimate } = {}) {
  const observed = validCounts(smokingLogs).slice(-7);
  const estimate = clampInt(onboardingEstimate, 1);

  if (observed.length >= 4) {
    return Math.max(1, Math.round(mean(observed)));
  }

  return estimate;
}

/**
 * Reduce by roughly 10%, with at least a one-cigarette step.
 * Reclaim never automatically sets a target below 1 cigarette/day.
 * Moving from 1 -> 0 is a separate explicit quit decision by the user.
 */
export function calculateNextTarget(currentTarget, {
  reductionRate = REDUCTION_RULES.defaultReductionRate,
  minimumDrop = REDUCTION_RULES.minimumWeeklyDrop,
} = {}) {
  const current = clampInt(currentTarget, REDUCTION_RULES.minimumAutomaticTarget);
  if (current <= REDUCTION_RULES.minimumAutomaticTarget) return REDUCTION_RULES.minimumAutomaticTarget;

  const rate = Number.isFinite(Number(reductionRate))
    ? Math.max(0, Number(reductionRate))
    : REDUCTION_RULES.defaultReductionRate;
  const drop = Math.max(clampInt(minimumDrop, 1), Math.round(current * rate));

  return Math.max(REDUCTION_RULES.minimumAutomaticTarget, current - drop);
}

export function classifyDay(actual, target) {
  const smoked = clampInt(actual, 0);
  const goal = clampInt(target, REDUCTION_RULES.minimumAutomaticTarget);
  if (smoked < goal) return 'under';
  if (smoked === goal) return 'on_target';
  return 'over';
}

/**
 * Week states are deliberately non-punitive:
 * - stable: most logged days were at/under target -> ready to reduce
 * - mixed: inconsistent -> hold target
 * - struggling: target is clearly too difficult -> hold and offer adjustment
 * - collect_more_data: not enough logs to judge
 */
export function classifyWeek({ dailyCounts = [], target } = {}) {
  const counts = validCounts(dailyCounts).slice(-REDUCTION_RULES.reviewWindowDays);
  const goal = clampInt(target, REDUCTION_RULES.minimumAutomaticTarget);

  if (counts.length < REDUCTION_RULES.minimumLoggedDaysForReview) {
    return {
      status: 'collect_more_data',
      loggedDays: counts.length,
      target: goal,
      average: counts.length ? mean(counts) : null,
      successDays: counts.filter(value => value <= goal).length,
      successRate: counts.length ? counts.filter(value => value <= goal).length / counts.length : 0,
    };
  }

  const successDays = counts.filter(value => value <= goal).length;
  const successRate = successDays / counts.length;
  const average = mean(counts);

  if (successRate >= REDUCTION_RULES.stableSuccessRate && average <= goal) {
    return { status: 'stable', loggedDays: counts.length, target: goal, average, successDays, successRate };
  }

  if (successRate < REDUCTION_RULES.strugglingSuccessRate && average > goal) {
    return { status: 'struggling', loggedDays: counts.length, target: goal, average, successDays, successRate };
  }

  return { status: 'mixed', loggedDays: counts.length, target: goal, average, successDays, successRate };
}

export function buildWeeklyReview({ dailyCounts = [], target, previousReviewStatus = null } = {}) {
  const week = classifyWeek({ dailyCounts, target });
  const goal = week.target;

  if (week.status === 'collect_more_data') {
    return {
      ...week,
      action: 'keep_logging',
      nextTarget: goal,
      message: 'Keep logging for a few more days. Reclaim will adjust only when there is enough real data.',
    };
  }

  if (week.status === 'stable') {
    return {
      ...week,
      action: goal > 1 ? 'reduce' : 'offer_quit_transition',
      nextTarget: calculateNextTarget(goal),
      message: goal > 1
        ? 'You handled this target consistently. Reclaim can lower the next target gently.'
        : 'You are holding at 1 cigarette a day. Moving to zero should be your choice, not an automatic step.',
    };
  }

  if (week.status === 'struggling') {
    const repeated = previousReviewStatus === 'struggling';
    return {
      ...week,
      action: repeated ? 'offer_adjustment' : 'hold',
      nextTarget: repeated ? goal + 1 : goal,
      message: repeated
        ? 'This target has felt too difficult across two reviews. Reclaim can temporarily raise it by one instead of punishing you.'
        : 'Hold this target for another week. One difficult week should not trigger a harsher plan.',
    };
  }

  return {
    ...week,
    action: 'hold',
    nextTarget: goal,
    message: 'This week was mixed. Keep the same target and build consistency before reducing again.',
  };
}

export function createInitialReductionPlan({ smokingLogs = [], onboardingEstimate } = {}) {
  const baseline = calculateBaseline({ smokingLogs, onboardingEstimate });
  const firstTarget = calculateNextTarget(baseline);

  return {
    baseline,
    currentTarget: firstTarget,
    minimumAutomaticTarget: REDUCTION_RULES.minimumAutomaticTarget,
    reductionRate: REDUCTION_RULES.defaultReductionRate,
    reviewWindowDays: REDUCTION_RULES.reviewWindowDays,
    stage: 1,
    status: 'active',
  };
}

export function applyWeeklyReview(plan = {}, dailyCounts = []) {
  const currentTarget = clampInt(plan.currentTarget, REDUCTION_RULES.minimumAutomaticTarget);
  const review = buildWeeklyReview({
    dailyCounts,
    target: currentTarget,
    previousReviewStatus: plan.lastReviewStatus || null,
  });

  const targetChanged = review.nextTarget !== currentTarget;

  return {
    ...plan,
    currentTarget: review.nextTarget,
    stage: clampInt(plan.stage || 1, 1) + (review.action === 'reduce' ? 1 : 0),
    lastReviewStatus: review.status,
    lastReview: review,
    targetChanged,
  };
}

export function getReductionProgress({ baseline, currentTarget } = {}) {
  const start = clampInt(baseline, 1);
  const target = clampInt(currentTarget, 1);
  const cigarettesReduced = Math.max(0, start - target);
  const percentReduced = start > 0 ? Math.round((cigarettesReduced / start) * 100) : 0;

  return {
    baseline: start,
    currentTarget: target,
    cigarettesReduced,
    percentReduced,
    atMinimumAutomaticTarget: target <= REDUCTION_RULES.minimumAutomaticTarget,
  };
}

export function summarizeToday({ smoked = 0, target } = {}) {
  const actual = clampInt(smoked, 0);
  const goal = clampInt(target, REDUCTION_RULES.minimumAutomaticTarget);
  const remaining = Math.max(0, goal - actual);
  const overBy = Math.max(0, actual - goal);

  return {
    smoked: actual,
    target: goal,
    remaining,
    overBy,
    status: classifyDay(actual, goal),
    reachedTarget: actual >= goal,
  };
}

// Compatibility exports for any older callers while the UI integration is migrated.
export const workingBaseline = ({ reported, observed = [] } = {}) =>
  calculateBaseline({ smokingLogs: observed, onboardingEstimate: reported });
export const nextTarget = currentTarget => calculateNextTarget(currentTarget);
export const reviewStage = ({ days = [], target, consecutiveStrugglingReviews = 0 } = {}) => {
  const previousReviewStatus = consecutiveStrugglingReviews > 0 ? 'struggling' : null;
  return buildWeeklyReview({ dailyCounts: days.map(day => day?.actual).filter(value => value != null), target, previousReviewStatus });
};
export function buildReductionPlan({ baseline } = {}) {
  const start = clampInt(baseline, 1);
  const targets = [start];
  let current = start;
  while (current > 1 && targets.length < 100) {
    current = calculateNextTarget(current);
    targets.push(current);
  }
  return targets;
}

export default {
  REDUCTION_RULES,
  clampInt,
  calculateBaseline,
  calculateNextTarget,
  classifyDay,
  classifyWeek,
  buildWeeklyReview,
  createInitialReductionPlan,
  applyWeeklyReview,
  getReductionProgress,
  summarizeToday,
  workingBaseline,
  nextTarget,
  reviewStage,
  buildReductionPlan,
};
