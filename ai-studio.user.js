// ==UserScript==
// @name         AI Studio Advanced Settings (Zero-Flash & Flexible Models)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Applies settings silently. Supports flexible model versioning (Gemini 3 priority).
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

    // Exit if iframe
    if (window.self !== window.top) return;

    // ===================================================================
    // === CONFIGURATION & MODEL PREFERENCES
    // ===================================================================
    
    // Priority lists: The script tries the first one; if missing, tries the next.
    const MODEL_PREFS = {
        PRO:   ['gemini-3-pro', 'gemini-3-pro-latest', 'gemini-3-pro-preview', 'gemini-2.5-pro'],
        FLASH: ['gemini-3-flash-latest', 'gemini-3-flash', 'gemini-3-flash-preview', 'gemini-flash-latest'],
        NANO:  ['gemini-3-flash-image', 'gemini-3-flash-image-preview', 'gemini-3-flash-image-latest', 'gemini-2.5-flash-image']
    };

    const DEFAULT_SETTINGS = {
        modelPrefs: MODEL_PREFS.PRO, // Default to Pro list
        budget: -1,
        grounding: false,
        sp: `You are a concise, expert-level assistant. Provide precise, actionable answers.

### Interaction Rules
- **Clarify first**: If a request is ambiguous, ask targeted questions.  
- **Inference rule**: If ambiguity is minor, state your assumption and proceed.  
- **Offer alternatives**: Briefly note valid options and trade-offs.  
- **Explain reasoning**: Give short rationale, especially for technical or code tasks.  
- **Handle impossibility**: If a solution is impossible, state it clearly and propose the closest feasible alternative.  
- **Verification rule**: For destructive or system-level operations, suggest a quick test or dry-run first.  
- **Propose next step**: End with a concrete suggestion framed as a question.  

### Response Formatting
- **Start with a 1–2 sentence summary** of key insights.  
- **Break down** complex problems into clear, numbered steps.  
- Use **lists** for steps or trade-offs and **tables** for structured comparisons.  
- Use **decision matrices** when presenting multiple options (Pros / Cons / When to use).  
- Suggest **external tools or references** when relevant.  
- Keep explanations **tight and non-redundant**.  
- **Summarize prior context** briefly before modifying work in iterative tasks.  

### Code Rules
- Follow **DRY**, write **clean, readable, performant** code.  
- Use consistent **typing and formatting** (e.g., Prettier).  
- Prefer **copy-pasteable terminal commands** over shell scripts when feasible.  
- When editing existing code, rewrite only changed sections with minimal context.  
- Add **concise comments** explaining logic or key parameters.  

### Tone & Behavior
- Be **direct, professional, and confident**.  
- Never mention being an AI.  
- Never apologize.  
- If unknown, say **“I don’t know with certainty. You could verify by…”**  
- Avoid disclaimers, cultural/political commentary, or moral reasoning.  
- **Blunt clarity > diplomatic vagueness.**

**Core Principle:**  
Be fast, factual, and structured. Focus on delivering maximum value with minimal noise.`
    };

    // Global lock to prevent interference
    let isBusy = false;

    // ===================================================================
    // === UTILITIES
    // ===================================================================

    function waitForElement(selector, callback, timeout = 10000) {
        const el = document.querySelector(selector);
        if (el) { callback(el); return; }
        
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) { obs.disconnect(); callback(element); }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); }, timeout);
    }

    // Inject CSS to hide overlays ONLY when script is automating
    const style = document.createElement('style');
    style.textContent = `
        body.script-automating .cdk-overlay-container,
        body.script-automating .cdk-overlay-backdrop,
        body.script-automating .cdk-overlay-pane {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            display: none !important; /* Aggressive hide */
        }
        /* Hide system instruction dropdown triggers permanently if desired */
        ms-system-instructions mat-form-field { display: none !important; }
    `;
    document.head.appendChild(style);

    function toggleAutomationMode(active) {
        if (active) {
            document.body.classList.add('script-automating');
            isBusy = true;
        } else {
            // Small delay to ensure overlays are actually gone/closed before showing UI again
            setTimeout(() => {
                document.body.classList.remove('script-automating');
                isBusy = false;
            }, 100);
        }
    }

    // ===================================================================
    // === CORE LOGIC
    // ===================================================================

    async function runMainLogic() {
        if (isBusy) return;
        console.log("[Tampermonkey] Applying settings...");

        const urlParams = new URLSearchParams(window.location.search);

        // 1. Determine Model Priority List
        let targetModelList = DEFAULT_SETTINGS.modelPrefs;
        const urlModel = urlParams.get('model');
        
        // If URL has a specific model, prioritize that single model, otherwise use defaults
        if (urlModel) targetModelList = [urlModel];

        // 2. Prepare Settings
        const settings = {
            modelList: targetModelList,
            budget: urlParams.has('budget') ? parseInt(urlParams.get('budget'), 10) : DEFAULT_SETTINGS.budget,
            grounding: urlParams.has('grounding') ? (urlParams.get('grounding') === 'true') : DEFAULT_SETTINGS.grounding,
            sp: urlParams.has('sp') ? decodeURIComponent(urlParams.get('sp')) : DEFAULT_SETTINGS.sp
        };

        // 3. Execute Automation
        // We wrap everything in one "busy" block to keep the screen stable
        toggleAutomationMode(true);
        
        try {
            // Select model first (highest priority)
            await selectBestModel(settings.modelList);
            
            // Apply other settings
            setThinkingBudget(settings.budget);
            setGrounding(settings.grounding);
            
            // Apply System Prompt
            await setSystemPrompt(settings.sp);
        } catch (e) {
            console.error("[Tampermonkey] Automation error:", e);
        } finally {
            toggleAutomationMode(false);
            
            // Handle YT/Focus logic after UI returns
            const ytUrlParam = urlParams.get('yt_url');
            if (ytUrlParam) {
                attachYouTubeVideo(decodeURIComponent(ytUrlParam), "Summarize this video.");
            } else {
                setTimeout(focusMainInput, 300);
            }
        }
    }

    // ===================================================================
    // === ACTION FUNCTIONS
    // ===================================================================

    function selectBestModel(candidateList) {
        return new Promise(resolve => {
            const selector = document.querySelector('.model-selector-card');
            if (!selector) { resolve(); return; }

            // 1. Check if current model is already one of the candidates (Optimization)
            const currentSubtitle = selector.querySelector('.subtitle')?.textContent?.trim();
            if (currentSubtitle && candidateList.some(m => currentSubtitle.includes(m))) {
                console.log(`[Tampermonkey] Already on preferred model: ${currentSubtitle}`);
                resolve();
                return;
            }

            // 2. Open Dropdown
            selector.click();

            // 3. Wait for list and pick best match
            waitForElement('ms-model-carousel-row', () => {
                let found = false;
                
                // Iterate through preferences in order
                for (const modelId of candidateList) {
                    // Exact ID match check
                    const btn = document.querySelector(`button[id="model-carousel-row-models/${modelId}"]`);
                    if (btn) {
                        console.log(`[Tampermonkey] Switching to: ${modelId}`);
                        btn.click();
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    console.warn("[Tampermonkey] No preferred models found in dropdown.");
                    // Close dropdown if nothing found
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                } else {
                     // Ensure backdrop closes (sometimes click isn't enough to close immediately)
                     setTimeout(() => {
                         const backdrop = document.querySelector('.cdk-overlay-backdrop');
                         if (backdrop) backdrop.click();
                     }, 50);
                }

                setTimeout(resolve, 150);
            }, 3000);
        });
    }

    function setSystemPrompt(promptText) {
        return new Promise(resolve => {
            const openBtn = document.querySelector('button[data-test-system-instructions-card]');
            if (!openBtn) { resolve(); return; }

            // Check if already set
            const hasContent = openBtn.querySelector('[class*="has-content"]');
            if (hasContent) { resolve(); return; }

            openBtn.click();

            // Wait for textarea
            waitForElement('textarea[aria-label="System instructions"]', (textArea) => {
                textArea.value = promptText;
                textArea.dispatchEvent(new Event('input', { bubbles: true }));

                // Close via backdrop
                setTimeout(() => {
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                    setTimeout(resolve, 150);
                }, 100);
            });
        });
    }

    function setThinkingBudget(val) {
        // 1. Enable thinking if disabled
        const thinkingToggle = document.querySelector('mat-slide-toggle[data-test-toggle="enable-thinking"] button');
        if (thinkingToggle && thinkingToggle.getAttribute('aria-checked') === 'false') {
            thinkingToggle.click();
        }

        // 2. Handle Manual vs Auto
        const manualToggle = document.querySelector('mat-slide-toggle[data-test-toggle="manual-budget"] button');
        if (manualToggle) {
            const isManual = manualToggle.getAttribute('aria-checked') === 'true';
            // If budget is -1 (Auto), ensure manual is OFF
            if (val === -1 && isManual) manualToggle.click();
            // If budget is >= 0, ensure manual is ON
            else if (val >= 0 && !isManual) manualToggle.click();
        }

        // 3. Set Slider
        if (val >= 0) {
            setSliderValue('[data-test-id="user-setting-budget-animation-wrapper"] input[type="range"]', val);
        }
    }

    function setGrounding(desiredState) {
        const toggle = document.querySelector('[data-test-id="searchAsAToolTooltip"] button[role="switch"]');
        if (toggle && (toggle.getAttribute('aria-checked') === 'true') !== desiredState) {
            toggle.click();
        }
    }

    function setSliderValue(selector, value) {
        const slider = document.querySelector(selector);
        if (slider) {
            slider.value = value;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function focusMainInput() {
        const el = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"], textarea[aria-label="Start typing a prompt"]');
        if (el) el.focus();
    }

    function attachYouTubeVideo(url, prompt) {
        // (Existing logic preserved)
        const area = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"]');
        if (!area) return;
        area.focus();
        area.value = url;
        area.dispatchEvent(new Event('input', { bubbles: true }));
        
        waitForElement('ms-youtube-chunk', () => {
            area.value = prompt;
            area.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => {
                const run = document.querySelector('button[aria-label="Run"][type="submit"]');
                if (run) run.click();
            }, 500);
        });
    }

    // ===================================================================
    // === EVENT LISTENERS & BUTTONS
    // ===================================================================

    // Manual Model Buttons (Using Priority Logic)
    function injectButtons() {
        waitForElement('.settings-item.settings-model-selector', (target) => {
            if (document.querySelector('.model-switch-buttons')) return;
            
            const div = document.createElement('div');
            div.className = 'model-switch-buttons';
            div.style.cssText = 'display:flex; gap:8px; margin-top:10px;';

            const createBtn = (text, list) => {
                const b = document.createElement('button');
                b.textContent = text;
                b.style.cssText = 'padding:6px 12px; cursor:pointer; border-radius:16px; border:1px solid #444; background:none; color:var(--mat-sys-on-surface);';
                b.onmouseover = () => b.style.backgroundColor = 'rgba(255,255,255,0.1)';
                b.onmouseout = () => b.style.backgroundColor = 'transparent';
                
                b.onclick = async () => {
                    toggleAutomationMode(true);
                    await selectBestModel(list);
                    toggleAutomationMode(false);
                };
                return b;
            };

            div.appendChild(createBtn('Pro', MODEL_PREFS.PRO));
            div.appendChild(createBtn('Flash', MODEL_PREFS.FLASH));
            div.appendChild(createBtn('Nano', MODEL_PREFS.NANO));

            target.parentNode.insertBefore(div, target.nextSibling);
        });
    }

    // Global Listeners
    function setupListeners() {
        // 1. Listen for "New Chat" clicks
        document.body.addEventListener('click', (e) => {
            const link = e.target.closest('a[href="/prompts/new_chat"]');
            if (link) {
                console.log("[Tampermonkey] New chat detected via click.");
                // Wait briefly for navigation to start, then run logic
                setTimeout(runMainLogic, 500);
            }
        });

        // 2. Inject buttons on load
        injectButtons();
    }

    // ===================================================================
    // === INIT
    // ===================================================================
    
    // Run on Load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupListeners();
            runMainLogic();
        });
    } else {
        setupListeners();
        runMainLogic();
    }

})();