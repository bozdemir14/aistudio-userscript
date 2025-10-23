// ==UserScript==
// @name         AI Studio Advanced Settings Setter (URL-Configurable)
// @namespace    http://tampermonkey.net/
// @version      3.9
// @description  Applies advanced settings to AI Studio from URL parameters or internal defaults.
// @author       You
// @match        https://aistudio.google.com/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/batuozdemir/browser-scripts/refs/heads/main/ai-studio.user.js
// @updateURL    https://raw.githubusercontent.com/batuozdemir/browser-scripts/refs/heads/main/ai-studio.user.js
// ==/UserScript==


(function() {
    'use strict';

    // ===================================================================
    // === HELPER: waitForElement
    // ===================================================================
    // Deneme2
    function waitForElement(selector, callback = null, timeout = 15000) {
        if (typeof callback === 'number') {
            timeout = callback;
            callback = null;
        }
        if (!callback) {
            return new Promise((resolve, reject) => {
                _waitForElementImpl(selector, resolve, timeout, reject);
            });
        }
        _waitForElementImpl(selector, callback, timeout);
        return undefined;
    }

    function _waitForElementImpl(selector, callback, timeout = 15000, rejectCallback = null) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect();
                callback(element);
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            const element = document.querySelector(selector);
            if (element) {
                callback(element);
            } else {
                const errorMsg = `[Tampermonkey] Timed out waiting for element: ${selector}`;
                console.error(errorMsg);
                if (rejectCallback) rejectCallback(new Error(errorMsg));
            }
        }, timeout);
    }

    // ===================================================================
    // === CORE LOGIC
    // ===================================================================

    async function runMainLogic() {
        console.log("[Tampermonkey] AI Studio UI is ready. Initializing script.");

const defaultSettings = {
    model: "gemini-2.5-pro",
    budget: -1,
    temp: 0,
    grounding: false,
    // System prompt:
    sp: `You are a concise, expert-level assistant. Provide precise, actionable answers.

## Interaction Rules
- **Clarify first**: Ask targeted questions if request is ambiguous.
- **Offer alternatives**: Briefly note valid options and trade-offs.
- **Explain reasoning**: For technical/code, give short rationale.
- **State assumptions**: Mention non-obvious assumptions.
- **Handle impossibility**: If a solution is impossible, state it clearly and then provide the closest feasible alternative or edge-case scenario.
- **Propose next step**: End with a concrete suggestion framed as a question.

## Answer Style
- Break down complex problems into clear steps.
- Summarize key points in 1–2 sentences before or after long explanations.
- Provide multiple perspectives when relevant.
- Support with evidence, stats, or credible sources.
- Use examples, analogies, and numerical comparisons when they aid clarity.
- Suggest external tools or sources for verification
- Correct mistakes when found.
- Avoid redundancy; keep explanations tight.
- Prioritize actionable, practical solutions.

## Code Rules
- Follow **DRY principles**, keep code simple, performant, readable.
- Use typing/formatting (e.g., Prettier).
- Provide copy-pasteable terminal commands instead of shell scripts when feasible.
- When editing long code, rewrite only changed sections + context.
- Add helpful comments.
- Remember prior context in iterations.

## Output Formatting
- Use **headings** for structure.
- Use **lists** for steps, options, or trade-offs.
- Use **tables** for comparisons, feature summaries, or structured data. Use other structured layouts too, when appropriate.
- Keep responses concise unless asked otherwise.

## Tone & Behavior
- Never mention being an AI.
- Never apologize.
- If unknown, answer only: **“I don’t know.”**
- No disclaimers, sourcing elsewhere, or hedging.
- Be direct, blunt if needed.
- Avoid cultural/political bias or ethics commentary.

## Handling Uncertainty
- When intent is unclear, list possible interpretations before proceeding.`
};

        const urlParams = new URLSearchParams(window.location.search);
        const settings = {
            model: urlParams.get('model') || defaultSettings.model,
            budget: urlParams.has('budget') ? parseInt(urlParams.get('budget'), 10) : defaultSettings.budget,
            temp: urlParams.has('temp') ? parseFloat(urlParams.get('temp')) : defaultSettings.temp,
            grounding: urlParams.has('grounding') ? (urlParams.get('grounding').toLowerCase() === 'true' || urlParams.get('grounding') === '1') : defaultSettings.grounding,
            sp: urlParams.has('sp') ? decodeURIComponent(urlParams.get('sp')) : defaultSettings.sp
        };

        setupGlobalClickListener();

        await applySettings(settings);

        const ytUrlParam = urlParams.get('yt_url');
        const fmParam = urlParams.get('fm');
        if (ytUrlParam) {
            attachYouTubeVideo(decodeURIComponent(ytUrlParam), "Summarize this video in a nice format.");
        } else if (fmParam) {
            setFirstMessage(decodeURIComponent(fmParam));
        } else {
            // FIXED: Delay the focus call to allow the UI to settle after settings changes.
            setTimeout(focusMainInput, 200);
        }
    }

    async function applySettings(settings) {
        await setModel(settings.model);
        setThinkingBudget(settings.budget);
        setTemperature(settings.temp);
        setGrounding(settings.grounding);
        await setSystemPrompt(settings.sp); // Now awaits this as well
    }

    // ===================================================================
    // === EVENT HANDLING
    // ===================================================================

function setupGlobalClickListener() {
    document.body.addEventListener('click', (event) => {
        const target = event.target;

        // Case 1: User starts a new chat.
        if (target.closest('a[href="/prompts/new_chat"]')) {
            setTimeout(() => setTemperature(0), 500);
            return;
        }

        // Case 2: User changes the model.
        if (target.closest('mat-option')) {
            // After the model dropdown closes, reset temperature and focus the input.
            setTimeout(() => {
                setTemperature(0);
                focusMainInput(); // Focus the main input box.
            }, 500);
            return;
        }

        // Keep original convenience handlers for manual toggle interactions.
        const button = target.closest('button');
        if (!button) return;

        if (button.matches('mat-slide-toggle[data-test-toggle="manual-budget"] button')) {
            setTimeout(() => {
                if (button.getAttribute('aria-checked') === 'true') {
                    setSliderValue('[data-test-id="user-setting-budget-animation-wrapper"] input[type="range"]', 128);
                }
            }, 50);
            focusMainInput();
        }

        if (button.matches('[data-test-id="searchAsAToolTooltip"] button[role="switch"]')) {
            focusMainInput();
        }
    }, true);
}

    // ===================================================================
    // === ACTION FUNCTIONS
    // ===================================================================

    function setSliderValue(selector, value) {
        const slider = document.querySelector(selector);
        if (slider) {
            slider.value = value;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function setModel(modelId) {
        return new Promise(resolve => {
            const modelSelectorTrigger = document.querySelector('[data-test-ms-model-selector]');
            if (!modelSelectorTrigger || modelSelectorTrigger.textContent.trim().includes(modelId)) {
                resolve();
                return;
            }
            modelSelectorTrigger.click();
            waitForElement('mat-option .base-model-subtitle', () => {
                const option = Array.from(document.querySelectorAll('mat-option .base-model-subtitle')).find(el => el.textContent.trim() === modelId);
                if (option) {
                    option.closest('mat-option').click();
                }
                setTimeout(() => {
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                    resolve();
                }, 150);
            });
        });
    }

    function setThinkingBudget(budgetValue) {
        const thinkingToggle = document.querySelector('mat-slide-toggle[data-test-toggle="enable-thinking"] button');
        if (thinkingToggle && thinkingToggle.getAttribute('aria-checked') === 'false') thinkingToggle.click();
        const manualToggle = document.querySelector('mat-slide-toggle[data-test-toggle="manual-budget"] button');
        if (!manualToggle) return;
        const isManual = manualToggle.getAttribute('aria-checked') === 'true';
        if (budgetValue === -1 && isManual) {
            manualToggle.click();
        } else if (budgetValue >= 0 && !isManual) {
            manualToggle.click();
        }
        if (budgetValue >= 0) {
            setSliderValue('[data-test-id="user-setting-budget-animation-wrapper"] input[type="range"]', budgetValue);
        }
    }

    function setTemperature(tempValue) {
        setSliderValue('[data-test-id="temperatureSliderContainer"] input[type="range"]', tempValue);
    }

    function setGrounding(desiredState) {
        const groundingToggle = document.querySelector('[data-test-id="searchAsAToolTooltip"] button[role="switch"]');
        if (groundingToggle && (groundingToggle.getAttribute('aria-checked') === 'true') !== desiredState) {
            groundingToggle.click();
        }
    }

    function setSystemPrompt(promptText) {
        return new Promise(resolve => {
            // 1. Selector for the open button (from previous fix)
            const openButton = document.querySelector('button[data-test-system-instructions-card]');
            if (!openButton) {
                console.error("[Tampermonkey] Failed to set system prompt: open button not found");
                resolve();
                return;
            }
            openButton.click();

            // 2. Wait for the textarea to appear
            waitForElement('textarea[aria-label="System instructions"]', (textArea) => {
                // FIX: Focus the textarea before setting its value to ensure it's interactive.
                textArea.focus();
                textArea.value = promptText;
                textArea.dispatchEvent(new Event('input', { bubbles: true }));

                // FIX: The close button selector has changed.
                // Old: 'button[aria-label="Close system instructions"]'
                // New: 'button[aria-label="Close panel"]'
                const closeButton = document.querySelector('button[aria-label="Close panel"]');
                if (closeButton) {
                    closeButton.click();
                } else {
                    console.error("[Tampermonkey] Could not find the system instructions close button.");
                }

                // Give a moment for the panel to close before resolving
                setTimeout(resolve, 150);
            }, 5000);
        });
    }


    function setFirstMessage(messageText) {
        const textArea = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"]');
        if (!textArea) return;
        textArea.value = messageText;
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
        textArea.dispatchEvent(enterEvent);
        textArea.focus();
    }

    function attachYouTubeVideo(videoUrl, promptText, retryAttempt = 0) {
        const textArea = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"]');
        if (!textArea) return;
        textArea.focus();
        textArea.value = '';
        textArea.dispatchEvent(new Event('input', { bubbles: true }));
        try {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', videoUrl);
            const pasteEvent = new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true });
            textArea.dispatchEvent(pasteEvent);
        } catch (e) {
            textArea.value = videoUrl;
            textArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        waitForElement('ms-youtube-chunk', 5000)
            .then(element => {
                textArea.value = promptText;
                textArea.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => {
                    const runButton = document.querySelector('button[aria-label="Run"][type="submit"]');
                    if (runButton) runButton.click();
                }, 500);
            })
            .catch(error => {
                if (retryAttempt < 2) {
                    setTimeout(() => attachYouTubeVideo(videoUrl, promptText, retryAttempt + 1), 1000);
                } else {
                    textArea.value = `${promptText}\n\nVideo URL: ${videoUrl}`;
                    textArea.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });
    }

    function focusMainInput() {
    // The aria-label changes between a new chat and an ongoing one.
    // This selector targets the textarea in either state.
    const selector = 'textarea[aria-label="Type something or tab to choose an example prompt"], textarea[aria-label="Start typing a prompt"]';
    const textArea = document.querySelector(selector);

    if (textArea) {
        textArea.focus();
        console.log("[Tampermonkey] Main input focused.");
    } else {
        console.warn("[Tampermonkey] Could not find the main input textarea to focus.");
    }
    }

    // ===================================================================
    // === SCRIPT START
    // ===================================================================

    window.addEventListener('error', (event) => console.error('[Tampermonkey] Uncaught error:', event.error));
    window.addEventListener('unhandledrejection', (event) => console.error('[Tampermonkey] Unhandled promise rejection:', event.reason));

    waitForElement('mat-slide-toggle[data-test-toggle="enable-thinking"]', runMainLogic);

    console.log("[Tampermonkey] AI Studio Advanced Settings Setter initialized.");

})();
