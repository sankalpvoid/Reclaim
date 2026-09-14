# Living Reclaim v2 app redesign

The approved petal, stretching figure and flowering path extend the Today visual language across the existing screens. Begin Journey remains unchanged. Shared presentation helpers own markup only; app.js retains navigation, auth, state and actions.

## Coverage
- Journey choice, account presentation, setup and mood check-in use the shared palette, typography and controls.
- Craving support retains all four working tools, now keyboard-operable illustrated buttons.
- Recovery, momentum, patterns, savings goals, community and settings use the same visual system.
- Quit, Reduce and Track preserve their existing navigation and calculations. Cigarette logging remains secondary to craving support.
- Community safety remains visible; no feature is hidden to simplify the layout.

## Verification
31 existing unit tests and 2 new presentation tests passed. All five existing browser suites passed unchanged. New app-v2 browser coverage passed for all journeys, navigation, four tools, community safety, profile editor, dark/light appearance and 320/390px overflow. Existing responsive suite covers six viewport sizes. Syntax and whitespace checks passed.

Reviewed screenshots of Today, support, recovery, patterns, setup and light settings. Illustrated headers retain readable white type; data and forms sit on quiet surfaces. Fixed navigation overlays in full-page captures are expected browser screenshot behavior. Updated screenshot waits to capture settled transitions.

The local test launcher uses sample data and backs up/restores local browser storage. Real email/OAuth authentication was not exercised against production; browser regression tests mock cloud responses. No production deployment performed. No new activity tracking, ritual engine, router or state manager introduced.
