import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true
});

const STATE_KEY = 'reclaim-state-v2';
const user = { id: '22222222-2222-4222-8222-222222222222' };
const profile = {
  name: 'Responsive Test',
  journeyMode: 'reduce',
  cigarettesPerDay: 20,
  dailyTarget: 18,
  quitAt: new Date(Date.now() - 864000000).toISOString(),
  pricePerPack: 300,
  cigarettesPerPack: 20,
  country: 'IN'
};

const viewports = [
  { width: 320, height: 568, label: '320x568' },
  { width: 360, height: 800, label: '360x800' },
  { width: 390, height: 844, label: '390x844' },
  { width: 430, height: 932, label: '430x932' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 1280, height: 800, label: '1280x800' }
];

function dbProfile(mode) {
  return {
    id: user.id,
    display_name: 'Responsive Test',
    journey_mode: mode,
    daily_target: 18,
    quit_date: profile.quitAt,
    cigarettes_per_day: 20,
    price_per_pack: 300,
    cigarettes_per_pack: 20,
    country: 'IN',
    onboarding_completed: true
  };
}

async function open(viewport, mode = 'reduce') {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    timezoneId: 'Asia/Kolkata'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await context.route('https://**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/rest/v1/') && !url.pathname.startsWith('/auth/v1/')) {
      return route.continue();
    }

    let data = [];
    if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname.includes('/profiles')) data = [dbProfile(mode)];
    else if (url.pathname.includes('/daily_checkins')) {
      data = [{ client_id: 'responsive-checkin', created_at: new Date().toISOString(), mood: 'okay' }];
    } else if (url.pathname.includes('/smoking_events')) data = [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data)
    });
  });

  await context.addInitScript(({ stateKey, user, profile, mode }) => {
    localStorage.setItem(stateKey, JSON.stringify({
      stage: 'app',
      view: 'home',
      profile: { ...profile, journeyMode: mode },
      smokingEvents: []
    }));
    localStorage.setItem('reclaim-session-v1', JSON.stringify({ access_token: 'test-token', user }));
    localStorage.setItem('reclaim-lifecycle-v1', JSON.stringify({ userId: user.id, lastActiveAt: Date.now() }));
  }, { stateKey: STATE_KEY, user, profile, mode });

  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4173');
  await page.locator(mode === 'quit' ? '.home-screen' : '.sj-screen').waitFor();
  return { context, page, errors };
}

async function assertNoHorizontalOverflow(page, label) {
  const layout = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body?.scrollWidth || 0;
    const offenders = [...document.querySelectorAll('body *')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: typeof element.className === 'string' ? element.className.slice(0, 80) : '',
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter(item => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .slice(0, 6);
    return { viewportWidth, documentWidth, bodyWidth, offenders };
  });

  assert.ok(
    layout.documentWidth <= layout.viewportWidth + 1,
    `${label} has horizontal overflow: ${JSON.stringify(layout)}`
  );
}

try {
  for (const viewport of viewports) {
    const reduce = await open(viewport, 'reduce');
    await assertNoHorizontalOverflow(reduce.page, `${viewport.label} Reduce home`);

    await reduce.page.locator('[data-view=insights]').first().click();
    await reduce.page.locator('.tracking-insights').waitFor();
    await assertNoHorizontalOverflow(reduce.page, `${viewport.label} Reduce insights`);

    await reduce.page.locator('[data-view=home]').first().click();
    await reduce.page.locator('[data-smoking-for-you]').click();
    await reduce.page.locator('.for-you-sheet').waitFor();
    await assertNoHorizontalOverflow(reduce.page, `${viewport.label} For You sheet`);

    assert.deepEqual(reduce.errors, [], `${viewport.label} Reduce emitted page errors`);
    await reduce.context.close();
  }

  for (const viewport of viewports) {
    const quit = await open(viewport, 'quit');
    await assertNoHorizontalOverflow(quit.page, `${viewport.label} Quit home`);

    await quit.page.locator('[data-view=more]').click();
    await assertNoHorizontalOverflow(quit.page, `${viewport.label} More`);
    await quit.page.locator('[data-edit-profile]').click();
    const quitPickerTrigger = quit.page.locator('[data-open-quit-picker]');
    await quitPickerTrigger.click();
    await quit.page.locator('.reclaim-time-card').waitFor();
    await assertNoHorizontalOverflow(quit.page, `${viewport.label} Quit date/time sheet`);
    assert.equal(
      await quit.page.locator('.reclaim-time-close').evaluate(element => element === document.activeElement),
      true,
      `${viewport.label} quit-time dialog should move focus to its close control`
    );

    await quit.page.keyboard.press('Escape');
    await quit.page.locator('.reclaim-time-modal').waitFor({ state: 'detached' });
    assert.equal(
      await quitPickerTrigger.evaluate(element => element === document.activeElement),
      true,
      `${viewport.label} quit-time dialog should restore focus after Escape`
    );

    await quitPickerTrigger.click();
    await quit.page.locator('.reclaim-time-card').waitFor();
    await quit.page.locator('[data-date-trigger]').click();
    await assertNoHorizontalOverflow(quit.page, `${viewport.label} Calendar`);
    await quit.page.locator('[data-cal-year-trigger]').click();
    await quit.page.locator('[data-cal-year-menu]').waitFor();
    await assertNoHorizontalOverflow(quit.page, `${viewport.label} Year picker`);

    assert.deepEqual(quit.errors, [], `${viewport.label} Quit emitted page errors`);
    await quit.context.close();
  }

  console.log(`PASS: responsive overflow, keyboard dialog, and page-error checks across ${viewports.length} viewport sizes.`);
} finally {
  await browser.close();
}
