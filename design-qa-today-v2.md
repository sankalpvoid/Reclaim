# Today-only rebuild

Base: origin/main 145f3f3946fbbf9680904333a2cef5757e7598dd. Branch: feature/living-reclaim-v2.

Scope: the existing Quit and tracking Today renderers call two pure presentation helpers. No additional state, lifecycle, event binding, router or navigation. Existing regression tests are unchanged. Old untracked Living UI modules are not imported or included in this change.

## Visual evidence
- Source: selected Living Reclaim direction, exec-9dc63ba7-1556-414a-b692-846d5360b688.png in the conversation generated-images folder.
- Combined comparison: /tmp/today-v2-comparison.png.
- Implementations: /tmp/today-v2-{quit,reduce,track}.png and matching -light.png files.
- Viewport: 390x844, density 1. Full-page captures retain scrollable content; reference normalized from 853x1844 to 390x844. Additional horizontal overflow checks at 320 and 768; existing responsive suite covers six widths.
- State: mocked/local journey state, actual renderer and existing action bindings. Current dates and log totals come from state rather than mock artwork.

## Review
- Typography: expressive serif welcome and movement heading; existing body typography and compact readable journey statistics. Existing brand/header retained intentionally.
- Spacing: support precedes all logging; compact count replaces oversized count. Existing plan/review/insight rows preserved, so Today is longer than the initial concept.
- Colors: plum/lilac/peach art direction; light surfaces keep dark illustrated regions and contrasting text.
- Imagery: existing generated petal and stretching assets used as decorative images, separate from live UI. No screenshot-as-interface.
- Content: movement action says five minutes and opens the current five-minute walking tool. No unsupported push-up flow or future destinations.
- Controls: existing header, navigation, review, logging, and check-in actions remain. Redundant Today floating craving shortcut hidden; primary craving support remains prominent.
- Focused review of the hero and movement sections found no text clipping. Full-page light capture can show fixed navigation across the scroll capture; that is not content loss. Existing viewport tests verify controls and overflow.

History: reduced excessive inherited spacing and recaptured. First light capture caught the entrance animation mid-fade; browser test now waits for computed opacity 1 before captures. Final dark/light captures inspected.

## Validation
- 31 unit/regression tests passed (27 existing, 4 added).
- Four unchanged browser suites passed: smoking-journey, reduction-cloud, responsive, startup-refresh.
- New Today browser suite passed: Quit/Reduce/Track, secondary logging, persistence after reload, current craving and walking tools, single navigation, no new destinations, light theme, responsive widths, no page errors.
- Syntax and git whitespace checks passed.
- Real production auth and real database writes were not exercised; browser data/network fixtures are isolated mocks.

final result: passed
