# AI Studio Userscript - Copilot Instructions

## Project Overview
This is a userscript project for automating Google AI Studio interactions. The codebase consists of Tampermonkey/Greasemonkey-compatible JavaScript files that manipulate the AI Studio web UI through DOM automation.

## Core Architecture Patterns

### DOM Automation Framework
- **Element Waiting**: Use `waitForElement(selector, callback, timeout)` for dynamic content. Always specify timeouts (default 15s) and handle failures.
- **Selector Strategy**: Prioritize `data-test-*` attributes over CSS classes. Fall back to ARIA labels when data attributes aren't available.
- **Event Simulation**: Simulate user interactions with `dispatchEvent()` rather than direct property changes. Include `{ bubbles: true }` for proper event propagation.

### State Management
- **Polling Loops**: Use `setInterval()` for checking UI state changes (e.g., temperature slider polling every 500ms).
- **MutationObserver**: Watch for DOM changes with subtree observation. Clean up observers with `disconnect()`.
- **State Machines**: Track automation progress with string states ('IDLE' → 'CLICKED_PLAY' → etc.).

## Key Implementation Patterns

### Settings Application (`ai-studio.user.js`)
```javascript
// Always check current state before applying changes
const currentModel = modelSelectorTrigger.querySelector('.subtitle')?.textContent?.trim();
if (currentModel === modelId) return; // Skip if already set

// Use Promise-based async/await for sequential operations
await setModel(settings.model);
setThinkingBudget(settings.budget);
```

### UI Interaction Helpers
```javascript
// Slider manipulation requires both input and change events
function setSliderValue(selector, value) {
    const slider = document.querySelector(selector);
    slider.value = value;
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
}
```

### Error Handling & Resilience
- **Timeout Protection**: All async operations have timeouts (5-15s typical).
- **Retry Logic**: Implement retry attempts for unreliable operations (YouTube attachment: 2 retries).
- **Graceful Degradation**: Fall back to plain text input if rich media attachment fails.

## Development Workflow

### Version Management
- **Manual Versioning**: Increment version numbers in userscript headers by 0.01 (e.g., 5.01 → 5.02) when making code changes
- **Version Format**: Use X.Y format (e.g., 5.01, 1.2) in the `@version` field of userscript headers

### Testing & Debugging
- **Console Logging**: Prefix all logs with `[Tampermonkey]` for easy filtering.
- **Browser Console**: Debug by inspecting element selectors and testing in browser dev tools.
- **Manual Testing**: Load scripts in Tampermonkey and test on `https://aistudio.google.com/`.

### Code Organization
- **IIFE Pattern**: Wrap entire script in `(function() { 'use strict'; ... })();`
- **Global Functions**: Expose utility functions on `window` object for console testing (e.g., `window.setModelPro()`).
- **CSS Injection**: Use `<style>` elements for hiding UI during automation, identified by `id='tampermonkey-system-instructions-style'`.

## Project-Specific Conventions

### Selector Patterns
- Model selector: `.model-selector-card .subtitle`
- Temperature slider: `[data-test-id="temperatureSliderContainer"] input[type="range"]`
- System instructions: `button[data-test-system-instructions-card]`
- Main input: `textarea[aria-label="Type something or tab to choose an example prompt"]`

### URL Parameter Handling
```javascript
const urlParams = new URLSearchParams(window.location.search);
const settings = {
    model: urlParams.get('model') || defaultSettings.model,
    temp: urlParams.has('temp') ? parseFloat(urlParams.get('temp')) : defaultSettings.temp
};
```

### Automation Hiding
- Add `hide-during-automation` CSS class to dialogs/backdrops during system prompt setting
- Use `opacity: 0` and `pointer-events: none` to hide UI without breaking functionality

## Common Pitfalls to Avoid

- **Direct Property Changes**: Never set `element.value = 'text'` without dispatching events
- **Race Conditions**: Always wait for elements to exist before interacting
- **Memory Leaks**: Clear intervals and disconnect observers when done
- **Selector Fragility**: Test selectors after AI Studio UI updates (Google changes them frequently)

## File Structure Reference
- `ai-studio.user.js`: Main automation script with settings application and YouTube integration
- `autoplay-bypass-ads.user.js`: Simpler ad-bypass script showing basic polling patterns
- Both follow identical userscript headers and IIFE structure