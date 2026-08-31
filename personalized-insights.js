(() => {
  const STORAGE_KEY = 'reclaim-state-v2';
  const TOOL_NAMES = {
    breathe: 'Box breathing',
    timer: 'Ride the wave',
    water: 'Water reset',
    walk: 'Take a short walk'
  };

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function periodStart(period) {
    const now = Date.now();
    if (period === 'week') return now - 7 * 864e5;
    if (period === 'month') return now - 30 * 864e5;
    return 0;
  }

  function daypart(date) {
    const hour = date.getHours();
    if (hour < 5) return 'late night';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'late night';
  }

  function cravingData() {
    const state = readState();
    const period = state.insightPeriod || 'week';
    const cutoff = periodStart(period);
    const all = Array.isArray(state.cravings) ? state.cravings : [];
    const cravings = all.filter(item => {
      const at = new Date(item.at || item.createdAt || 0).getTime();
      return Number.isFinite(at) && at >= cutoff;
    });
    return { period, cravings };
  }

  function patternInsight(cravings) {
    if (cravings.length < 3) {
      return {
        eyebrow: 'CRAVING PATTERN',
        value: 'Still learning',
        copy: 'After a few more logged cravings, Reclaim can show when urges tend to appear.'
      };
    }

    const counts = new Map();
    for (const craving of cravings) {
      const key = daypart(new Date(craving.at || craving.createdAt));
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const [part, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const pct = Math.round((count / cravings.length) * 100);
    return {
      eyebrow: 'CRAVING PATTERN',
      value: `${part[0].toUpperCase()}${part.slice(1)}s`,
      copy: `${count} of ${cravings.length} logged cravings (${pct}%) happened in the ${part}.`
    };
  }

  function toolInsight(cravings) {
    const rated = cravings.filter(item => item.tool && item.feedback && item.feedback !== 'skip');
    if (rated.length < 2) {
      return {
        eyebrow: 'WHAT HELPS',
        value: 'Keep using what works',
        copy: 'Optional “Did that help?” feedback will quietly teach Reclaim which reset works best for you.'
      };
    }

    const scores = { yes: 2, a_little: 1, not_really: 0 };
    const byTool = new Map();
    for (const item of rated) {
      if (!(item.feedback in scores)) continue;
      const result = byTool.get(item.tool) || { count: 0, score: 0, yes: 0 };
      result.count += 1;
      result.score += scores[item.feedback];
      if (item.feedback === 'yes') result.yes += 1;
      byTool.set(item.tool, result);
    }

    const ranked = [...byTool.entries()]
      .filter(([, result]) => result.count >= 2)
      .sort((a, b) => (b[1].score / b[1].count) - (a[1].score / a[1].count) || b[1].count - a[1].count);

    if (!ranked.length) {
      return {
        eyebrow: 'WHAT HELPS',
        value: 'A pattern is forming',
        copy: `${rated.length} tool check-ins recorded. Reclaim will recommend a favorite once there is enough evidence.`
      };
    }

    const [tool, result] = ranked[0];
    const positive = result.score > 0;
    return {
      eyebrow: 'WHAT HELPS',
      value: positive ? (TOOL_NAMES[tool] || 'Your reset') : 'Try a different reset',
      copy: positive
        ? `${TOOL_NAMES[tool] || 'This tool'} has your strongest feedback so far across ${result.count} check-ins.`
        : 'Your recent feedback suggests trying another craving tool next time.'
    };
  }

  function resilienceInsight(cravings) {
    if (!cravings.length) {
      return {
        eyebrow: 'YOUR RESPONSE',
        value: 'No cravings logged',
        copy: 'When an urge does show up, logging it helps Reclaim learn without asking you to journal.'
      };
    }
    const resisted = cravings.filter(item => item.resisted).length;
    return {
      eyebrow: 'YOUR RESPONSE',
      value: `${resisted} of ${cravings.length} ridden out`,
      copy: resisted === cravings.length
        ? 'Every craving you logged in this period was marked as resisted.'
        : 'This is a record of responses, not a score. Setbacks do not erase progress.'
    };
  }

  function render() {
    const app = document.querySelector('#app');
    const screen = app?.querySelector('.screen');
    const brand = screen?.querySelector('.topbar .brand');
    if (!screen || brand?.textContent.trim() !== 'INSIGHTS') return;

    const anchor = screen.querySelector('.period-caption');
    if (!anchor) return;

    const { cravings } = cravingData();
    const cards = [patternInsight(cravings), toolInsight(cravings), resilienceInsight(cravings)];
    const signature = JSON.stringify(cards);

    let block = screen.querySelector('#personalized-insights');
    if (!block) {
      block = document.createElement('section');
      block.id = 'personalized-insights';
      block.className = 'personalized-insights';
      anchor.insertAdjacentElement('afterend', block);
    }
    if (block.dataset.signature === signature) return;
    block.dataset.signature = signature;
    block.innerHTML = `
      <div class="personalized-insights-heading">
        <div>
          <div class="eyebrow">LEARNING FROM YOUR JOURNEY</div>
          <h2>YOUR PATTERNS</h2>
        </div>
        <span class="insight-private">PRIVATE TO YOU</span>
      </div>
      <div class="personalized-insights-grid">
        ${cards.map(card => `
          <article class="card personal-insight-card">
            <div class="eyebrow">${card.eyebrow}</div>
            <strong>${card.value}</strong>
            <p>${card.copy}</p>
          </article>
        `).join('')}
      </div>
      <p class="personalized-insights-note">No extra check-ins required. These patterns come from activity you already log in Reclaim.</p>
    `;
  }

  const observer = new MutationObserver(() => queueMicrotask(render));

  function start() {
    const app = document.querySelector('#app');
    if (!app) return;
    observer.observe(app, { childList: true, subtree: true });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
