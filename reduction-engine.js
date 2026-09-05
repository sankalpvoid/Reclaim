export const REDUCTION_PACES = Object.freeze({
  gentle: 0.10,
  balanced: 0.15,
  fast: 0.20,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundCigarettes = value => Math.max(0, Math.round(Number(value) || 0));

export function workingBaseline({ reported, observed = [] } = {}) {
  const reportedValue = Math.max(1, Number(reported) || 1);
  const validObserved = observed
    .map(Number)
    .filter(value => Number.isFinite(value) && value >= 0);

  if (!validObserved.length) return roundCigarettes(reportedValue);

  const observedAverage = validObserved.reduce((sum, value) => sum + value, 0) / validObserved.length;
  return Math.max(1, roundCigarettes(observedAverage * 0.7 + reportedValue * 0.3));
}

export function nextTarget(currentTarget, pace = 'balanced') {
  const current = Math.max(0, roundCigarettes(currentTarget));
  if (current <= 0) return 0;
  if (current <= 4) return current - 1;

  const rate = REDUCTION_PACES[pace] ?? REDUCTION_PACES.balanced;
  const requestedDrop = Math.max(1, Math.round(current * rate));
  const maxDrop = Math.max(1, Math.floor(current * 0.25));
  const drop = clamp(requestedDrop, 1, maxDrop);

  return Math.max(0, current - drop);
}

export function classifyDay(actual, target) {
  const cigarettes = Math.max(0, roundCigarettes(actual));
  const dailyTarget = Math.max(0, roundCigarettes(target));

  if (cigarettes < dailyTarget) return 'under';
  if (cigarettes === dailyTarget) return 'on';
  if (cigarettes === dailyTarget + 1) return 'slightly_over';
  return 'over';
}

export function reviewStage({ days = [], target, pace = 'balanced', consecutiveStrugglingReviews = 0 } = {}) {
  const dailyTarget = Math.max(0, roundCigarettes(target));
  const completedDays = days
    .filter(day => day && day.complete !== false)
    .slice(-7)
    .map(day => ({ ...day, actual: Math.max(0, roundCigarettes(day.actual)) }));

  if (completedDays.length < 4) {
    return {
      status: 'collect_more_data',
      target: dailyTarget,
      nextTarget: dailyTarget,
      completedDays: completedDays.length,
      message: 'Keep logging. Reclaim needs at least four completed days before judging this stage.',
    };
  }

  const total = completedDays.reduce((sum, day) => sum + day.actual, 0);
  const average = total / completedDays.length;
  const successfulDays = completedDays.filter(day => day.actual <= dailyTarget).length;
  const requiredSuccesses = completedDays.length >= 7 ? 5 : Math.ceil(completedDays.length * 0.7);

  const earlyAdvance = completedDays.length >= 4
    && completedDays.every(day => day.actual <= dailyTarget)
    && average <= dailyTarget - 2;

  if (earlyAdvance) {
    return {
      status: 'offer_early_advance',
      target: dailyTarget,
      nextTarget: nextTarget(dailyTarget, pace),
      average,
      successfulDays,
      completedDays: completedDays.length,
      message: 'You are consistently ahead of this target. Reclaim can offer the next step early.',
    };
  }

  if (completedDays.length >= 7 && successfulDays >= requiredSuccesses && average <= dailyTarget) {
    return {
      status: 'advance',
      target: dailyTarget,
      nextTarget: nextTarget(dailyTarget, pace),
      average,
      successfulDays,
      completedDays: completedDays.length,
      message: 'This target looks stable. Move to the next step.',
    };
  }

  const struggling = completedDays.length >= 7
    && successfulDays < 3
    && average > dailyTarget + 1;

  if (struggling) {
    const repeated = consecutiveStrugglingReviews >= 1;
    return {
      status: repeated ? 'offer_adjust_up' : 'hold_struggling',
      target: dailyTarget,
      nextTarget: repeated ? dailyTarget + 1 : dailyTarget,
      average,
      successfulDays,
      completedDays: completedDays.length,
      message: repeated
        ? 'This stage has stayed difficult across two reviews. Offer a temporary one-cigarette adjustment.'
        : 'Hold this target for another stage and learn what made the week difficult.',
    };
  }

  return {
    status: 'hold',
    target: dailyTarget,
    nextTarget: dailyTarget,
    average,
    successfulDays,
    completedDays: completedDays.length,
    message: 'Stay at this target and build a little more consistency before reducing again.',
  };
}

export function buildReductionPlan({ baseline, pace = 'balanced' } = {}) {
  const start = Math.max(1, roundCigarettes(baseline));
  const targets = [start];
  let current = start;

  while (current > 0 && targets.length < 100) {
    current = nextTarget(current, pace);
    targets.push(current);
  }

  return targets;
}
