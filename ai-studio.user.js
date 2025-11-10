// ==UserScript==
// @name         AI Studio Advanced Settings Setter (URL-Configurable)
// @namespace    http://tampermonkey.net/
// @version      5.02
// @description  Applies advanced settings to AI Studio from URL parameters or internal defaults.
// @author       You
// @match        https://aistudio.google.com/prompts/*
// @grant        none
// @inject-into  content
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/bozdemir14/aistudio-userscript/refs/heads/main/ai-studio.user.js
// @updateURL    https://raw.githubusercontent.com/bozdemir14/aistudio-userscript/refs/heads/main/ai-studio.user.js
// ==/UserScript==


(function() {
    'use strict';

    // Exit early if we're in an iframe
    if (window.self !== window.top) {
        return;
    }

    // ===================================================================
    // === HELPER: waitForElement
    // ===================================================================
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
        console.log("[Tampermonkey] Running main logic to apply settings.");

        // Always set up the click listener for new chat detection
        setupGlobalClickListener();

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
        // The polling mechanism will automatically detect temperature=1 and apply settings
        if (target.closest('a[href="/prompts/new_chat"]')) {
            console.log("[Tampermonkey] New chat button clicked, polling will handle settings.");
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
            const modelSelectorTrigger = document.querySelector('.model-selector-card');
            if (!modelSelectorTrigger) {
                console.error("[Tampermonkey] Model selector trigger not found");
                resolve();
                return;
            }
            // Check if already selected by checking the subtitle
            const currentModel = modelSelectorTrigger.querySelector('.subtitle')?.textContent?.trim();
            if (currentModel === modelId) {
                resolve();
                return;
            }
            // Set flag before clicking to hide overlay immediately
            isAutomatingModelSelection = true;
            modelSelectorTrigger.click();
            waitForElement('ms-model-carousel-row', () => {
                const modelButton = document.querySelector(`button[id="model-carousel-row-models/${modelId}"]`);
                if (modelButton) {
                    modelButton.click();
                } else {
                    console.error(`[Tampermonkey] Model button for ${modelId} not found`);
                }
                setTimeout(() => {
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                    // Reset flag after closing
                    isAutomatingModelSelection = false;
                    resolve();
                }, 150);
            }, 5000);
        });
    }

    // Global functions for one-click model switching
    window.setModelPro = () => setModel('gemini-2.5-pro');
    window.setModelFlash = () => setModel('gemini-flash-latest');
    window.setModelNano = () => setModel('gemini-2.5-flash-image');

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
            
            // Check if system prompt is already set by checking if the button has content indicator
            const hasExistingPrompt = openButton.querySelector('[class*="has-content"]') || 
                                     openButton.textContent.includes('Edit') ||
                                     openButton.getAttribute('aria-label')?.includes('Edit');
            
            if (hasExistingPrompt) {
                console.log("[Tampermonkey] System prompt already set, skipping.");
                resolve();
                return;
            }
            
            // Set flag BEFORE clicking to ensure observer catches it
            isAutomatingSystemPrompt = true;
            console.log("[Tampermonkey] Starting automated system prompt setting (hidden mode).");
            
            // Click to open the dialog
            openButton.click();

            // Wait for the dialog container first
            waitForElement('.mat-mdc-dialog-container', (dialogContainer) => {
                dialogContainer.classList.add('hide-during-automation');
                
                // Also hide the overlay pane if it exists
                const overlayPane = document.querySelector('.cdk-overlay-pane');
                if (overlayPane) {
                    overlayPane.classList.add('hide-during-automation');
                }
                
                // Also hide the backdrop if it exists
                const backdrop = document.querySelector('.cdk-overlay-backdrop');
                if (backdrop) {
                    backdrop.classList.add('hide-during-automation');
                }
                
                // Wait for the textarea to appear
                waitForElement('textarea[aria-label="System instructions"]', (textArea) => {
                    // Set the value without focusing (to avoid interfering with user typing)
                    textArea.value = promptText;
                    textArea.dispatchEvent(new Event('input', { bubbles: true }));

                    // Close the dialog by clicking the backdrop
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) {
                        backdrop.click();
                    } else {
                        console.error("[Tampermonkey] Could not find the backdrop to close system instructions dialog.");
                    }

                    // Clean up: remove hiding classes and reset flag
                    setTimeout(() => {
                        dialogContainer.classList.remove('hide-during-automation');
                        if (overlayPane) {
                            overlayPane.classList.remove('hide-during-automation');
                        }
                        if (backdrop) {
                            backdrop.classList.remove('hide-during-automation');
                        }
                        isAutomatingSystemPrompt = false;
                        console.log("[Tampermonkey] Automated system prompt setting complete.");
                    }, 100);

                    // Give a moment for the panel to close before resolving
                    setTimeout(resolve, 150);
                }, 5000);
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

    // Hide the system instructions preset dropdown menu
    function hideSystemInstructionsDropdown() {
        const style = document.createElement('style');
        style.id = 'tampermonkey-system-instructions-style';
        style.textContent = `
            /* Hide the system instructions preset dropdown - aggressive selector */
            ms-system-instructions mat-form-field.mat-mdc-form-field-type-mat-select,
            ms-system-instructions mat-form-field[class*="mat-select"],
            ms-system-instructions .mat-mdc-form-field-type-mat-select,
            div[class*="panel-content"] ms-system-instructions mat-form-field:first-of-type {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                opacity: 0 !important;
            }
            
            /* Adjust spacing since dropdown is hidden */
            ms-system-instructions .title-row {
                margin-top: 0 !important;
            }
            
            /* AGGRESSIVE: Hide ALL system instruction dialogs by default */
            .cdk-overlay-pane:has([id*="mat-mdc-dialog-title"]:has(.title)),
            .cdk-overlay-pane:has(.panel-header .title) {
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: none !important;
            }
            
            /* Show them only when manually opened (not during automation) */
            .cdk-overlay-pane.user-opened {
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }
            
            /* Hide backdrop during automation */
            .cdk-overlay-backdrop.hide-during-automation {
                opacity: 0 !important;
                pointer-events: none !important;
                visibility: hidden !important;
                transition: none !important;
            }
            
            /* Hide overlay pane during automation */
            .cdk-overlay-pane.hide-during-automation {
                opacity: 0 !important;
                visibility: hidden !important;
                pointer-events: none !important;
                transition: none !important;
            }
        `;
        document.head.appendChild(style);
        console.log("[Tampermonkey] System instructions dropdown hidden.");
    }

    // Apply the style immediately (before DOM fully loads)
    hideSystemInstructionsDropdown();
    
    // Watch for system instruction dialogs and hide them immediately during automation
    let isAutomatingSystemPrompt = false;
    let isAutomatingModelSelection = false;
    const dialogObserver = new MutationObserver((mutations) => {
        if (!isAutomatingSystemPrompt && !isAutomatingModelSelection) return;
        
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) { // Element node
                    // Check if this is the overlay pane for system instructions
                    if (node.classList && node.classList.contains('cdk-overlay-pane')) {
                        const dialogTitle = node.querySelector('[class*="panel-header"] .title');
                        if (dialogTitle && dialogTitle.textContent.includes('System instructions')) {
                            node.classList.add('hide-during-automation');
                            console.log("[Tampermonkey] System instructions dialog hidden during automation.");
                        }
                        // Also check for model selection overlay
                        if (isAutomatingModelSelection && node.querySelector('ms-model-carousel-row')) {
                            node.classList.add('hide-during-automation');
                            console.log("[Tampermonkey] Model selection overlay hidden during automation.");
                        }
                    }
                    // Also hide the backdrop
                    if (node.classList && node.classList.contains('cdk-overlay-backdrop')) {
                        node.classList.add('hide-during-automation');
                    }
                }
            }
        }
    });
    
    // Start observing immediately
    dialogObserver.observe(document.body, { childList: true, subtree: true });

    // Inject model switch buttons
    waitForElement('.settings-item.settings-model-selector', (modelSelectorDiv) => {
        if (document.querySelector('.model-switch-buttons')) return;
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'model-switch-buttons';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginTop = '10px';
        const proButton = document.createElement('button');
        proButton.textContent = 'Pro';
        proButton.onclick = () => window.setModelPro();
        proButton.style.padding = '5px 10px';
        proButton.style.cursor = 'pointer';
        const flashButton = document.createElement('button');
        flashButton.textContent = 'Flash';
        flashButton.onclick = () => window.setModelFlash();
        flashButton.style.padding = '5px 10px';
        flashButton.style.cursor = 'pointer';
        const nanoButton = document.createElement('button');
        nanoButton.textContent = 'Nano Banana';
        nanoButton.onclick = () => window.setModelNano();
        nanoButton.style.padding = '5px 10px';
        nanoButton.style.cursor = 'pointer';
        buttonContainer.appendChild(proButton);
        buttonContainer.appendChild(flashButton);
        buttonContainer.appendChild(nanoButton);
        modelSelectorDiv.parentNode.insertBefore(buttonContainer, modelSelectorDiv.nextSibling);
    });

    window.addEventListener('error', (event) => console.error('[Tampermonkey] Uncaught error:', event.error));
    window.addEventListener('unhandledrejection', (event) => console.error('[Tampermonkey] Unhandled promise rejection:', event.reason));

    let isRunning = false;
    let pollInterval = null;

    // Polling function to check temperature every 0.5 seconds
    function checkAndApplySettings() {
        // Don't check if already running
        if (isRunning) {
            return;
        }

        const tempSlider = document.querySelector('[data-test-id="temperatureSliderContainer"] input[type="range"]');
        
        if (tempSlider && parseFloat(tempSlider.value) === 1) {
            console.log("[Tampermonkey] Temperature is 1, applying settings...");
            isRunning = true;
            
            runMainLogic().then(() => {
                console.log("[Tampermonkey] Settings applied successfully.");
                isRunning = false;
            }).catch((error) => {
                console.error("[Tampermonkey] Error applying settings:", error);
                isRunning = false;
            });
        }
    }

    // Start polling every 500ms
    function startPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
        }
        console.log("[Tampermonkey] Starting temperature polling...");
        pollInterval = setInterval(checkAndApplySettings, 500);
    }

    // Initialize immediately if DOM is ready, otherwise wait
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPolling);
    } else {
        startPolling();
    }

})();
