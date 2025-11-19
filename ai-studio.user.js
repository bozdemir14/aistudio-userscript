// ==UserScript==
// @name         AI Studio Advanced Settings (Zero-Flash & Flexible Models)
// @namespace    http://tampermonkey.net/
// @version      7.1
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

    if (window.self !== window.top) return;

    // ===================================================================
    // === CONFIGURATION
    // ===================================================================
    
    const MODEL_PREFS = {
        PRO:   ['gemini-3-pro', 'gemini-3-pro-latest', 'gemini-3-pro-preview', 'gemini-2.5-pro', 'gemini-1.5-pro'],
        // Added 2.5-flash specifically for Safari/Production compatibility
        FLASH: ['gemini-3-flash-latest', 'gemini-3-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-1.5-flash'],
        NANO:  ['gemini-3-flash-image', 'gemini-3-flash-image-preview', 'gemini-2.5-flash-image']
    };

    const DEFAULT_SETTINGS = {
        modelPrefs: MODEL_PREFS.PRO,
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

    // CSS for hiding automation and styling buttons
    const style = document.createElement('style');
    style.textContent = `
        body.script-automating .cdk-overlay-container,
        body.script-automating .cdk-overlay-backdrop,
        body.script-automating .cdk-overlay-pane {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            display: none !important;
        }
        ms-system-instructions mat-form-field { display: none !important; }
        
        /* Custom Button Styles */
        .as-custom-btn {
            padding: 4px 10px; 
            cursor: pointer; 
            border-radius: 16px; 
            border: 1px solid #555; 
            background: none; 
            color: var(--mat-sys-on-surface); 
            font-size: 13px;
        }
        .as-custom-btn:hover { background-color: rgba(255,255,255,0.1); }
        .as-btn-group { display: flex; gap: 8px; margin-top: 8px; margin-bottom: 8px; }
    `;
    document.head.appendChild(style);

    function toggleAutomationMode(active) {
        if (active) {
            document.body.classList.add('script-automating');
            isBusy = true;
        } else {
            setTimeout(() => {
                document.body.classList.remove('script-automating');
                isBusy = false;
            }, 100);
        }
    }

    function focusMainInput() {
        // Small delay to allow UI to settle (e.g., toggle animations)
        setTimeout(() => {
            const el = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"], textarea[aria-label="Start typing a prompt"]');
            if (el) {
                el.focus();
                // Move cursor to end
                const val = el.value;
                el.value = '';
                el.value = val;
            }
        }, 150);
    }

    // ===================================================================
    // === CORE LOGIC
    // ===================================================================

    async function runMainLogic() {
        if (isBusy) return;
        
        const urlParams = new URLSearchParams(window.location.search);
        let targetModelList = DEFAULT_SETTINGS.modelPrefs;
        const urlModel = urlParams.get('model');
        if (urlModel) targetModelList = [urlModel];

        const settings = {
            modelList: targetModelList,
            budget: urlParams.has('budget') ? parseInt(urlParams.get('budget'), 10) : DEFAULT_SETTINGS.budget,
            grounding: urlParams.has('grounding') ? (urlParams.get('grounding') === 'true') : DEFAULT_SETTINGS.grounding,
            sp: urlParams.has('sp') ? decodeURIComponent(urlParams.get('sp')) : DEFAULT_SETTINGS.sp
        };

        toggleAutomationMode(true);
        
        try {
            await selectBestModel(settings.modelList);
            setThinkingBudget(settings.budget);
            setGrounding(settings.grounding);
            await setSystemPrompt(settings.sp);
        } catch (e) {
            console.error("[Tampermonkey] Automation error:", e);
        } finally {
            toggleAutomationMode(false);
            
            const ytUrlParam = urlParams.get('yt_url');
            if (ytUrlParam) {
                attachYouTubeVideo(decodeURIComponent(ytUrlParam), "Summarize this video.");
            } else {
                focusMainInput();
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

            const currentSubtitle = selector.querySelector('.subtitle')?.textContent?.trim();
            if (currentSubtitle && candidateList.some(m => currentSubtitle.includes(m))) {
                resolve();
                return;
            }

            selector.click();

            waitForElement('ms-model-carousel-row', () => {
                let found = false;
                for (const modelId of candidateList) {
                    const btn = document.querySelector(`button[id="model-carousel-row-models/${modelId}"]`);
                    if (btn) {
                        btn.click();
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    console.warn("[Tampermonkey] No preferred models found. List:", candidateList);
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                } else {
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

            const hasContent = openBtn.querySelector('[class*="has-content"]');
            if (hasContent) { resolve(); return; }

            openBtn.click();
            waitForElement('textarea[aria-label="System instructions"]', (textArea) => {
                textArea.value = promptText;
                textArea.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => {
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                    setTimeout(resolve, 150);
                }, 100);
            });
        });
    }

    function setThinkingBudget(val) {
        // Enable Thinking Toggle if needed
        const thinkingToggle = document.querySelector('mat-slide-toggle[data-test-toggle="enable-thinking"] button');
        if (thinkingToggle && thinkingToggle.getAttribute('aria-checked') === 'false') {
            thinkingToggle.click();
        }

        // Logic for Gemini 2.5 Slider
        const manualToggle = document.querySelector('mat-slide-toggle[data-test-toggle="manual-budget"] button');
        if (manualToggle) {
            const isManual = manualToggle.getAttribute('aria-checked') === 'true';
            if (val === -1 && isManual) manualToggle.click();
            else if (val >= 0 && !isManual) manualToggle.click();
        }

        if (val >= 0) {
            const slider = document.querySelector('[data-test-id="user-setting-budget-animation-wrapper"] input[type="range"]');
            if (slider) {
                slider.value = val;
                slider.dispatchEvent(new Event('input', { bubbles: true }));
                slider.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // New Logic for Gemini 3 "Thinking Level" (High/Low)
    async function setThinkingLevel(level) {
        const select = document.querySelector('mat-select[aria-label="Thinking Level"]');
        if (!select) return;

        // Check current text
        const currentVal = select.querySelector('.mat-mdc-select-value-text')?.textContent?.trim();
        if (currentVal === level) {
            focusMainInput();
            return;
        }

        toggleAutomationMode(true);
        select.click();

        // Wait for overlay options
        waitForElement('.cdk-overlay-pane mat-option', () => {
            const options = document.querySelectorAll('mat-option');
            for (const opt of options) {
                if (opt.textContent.includes(level)) {
                    opt.click();
                    break;
                }
            }
            toggleAutomationMode(false);
            focusMainInput();
        }, 2000);
    }

    function setGrounding(desiredState) {
        const toggle = document.querySelector('[data-test-id="searchAsAToolTooltip"] button[role="switch"]');
        if (toggle && (toggle.getAttribute('aria-checked') === 'true') !== desiredState) {
            toggle.click();
        }
    }

    function attachYouTubeVideo(url, prompt) {
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
    // === UI INJECTION
    // ===================================================================

    function createBtn(text, onClick) {
        const b = document.createElement('button');
        b.textContent = text;
        b.className = 'as-custom-btn';
        b.onclick = (e) => {
            e.preventDefault();
            onClick();
        };
        return b;
    }

    function injectButtons() {
        // 1. Model Buttons
        waitForElement('.settings-item.settings-model-selector', (target) => {
            if (document.querySelector('.model-switch-buttons')) return;
            const div = document.createElement('div');
            div.className = 'model-switch-buttons as-btn-group';
            
            div.appendChild(createBtn('Pro', async () => {
                toggleAutomationMode(true);
                await selectBestModel(MODEL_PREFS.PRO);
                toggleAutomationMode(false);
                focusMainInput();
            }));
            
            div.appendChild(createBtn('Flash', async () => {
                toggleAutomationMode(true);
                await selectBestModel(MODEL_PREFS.FLASH);
                toggleAutomationMode(false);
                focusMainInput();
            }));
            
            div.appendChild(createBtn('Nano', async () => {
                toggleAutomationMode(true);
                await selectBestModel(MODEL_PREFS.NANO);
                toggleAutomationMode(false);
                focusMainInput();
            }));

            target.parentNode.insertBefore(div, target.nextSibling);
        });

        // 2. Thinking Level Buttons (Gemini 3)
        // Find the header, then find the parent settings-item
        const observer = new MutationObserver(() => {
            const headers = Array.from(document.querySelectorAll('h3.item-description-title'));
            const thinkingHeader = headers.find(h => h.textContent.trim() === 'Thinking level');
            
            if (thinkingHeader) {
                // Navigate up to the settings item container
                const container = thinkingHeader.closest('.settings-item');
                if (container && !container.nextElementSibling?.classList.contains('thinking-level-buttons')) {
                    const div = document.createElement('div');
                    div.className = 'thinking-level-buttons as-btn-group';
                    div.style.marginLeft = '16px'; // Align visually
                    
                    div.appendChild(createBtn('High', () => setThinkingLevel('High')));
                    div.appendChild(createBtn('Low', () => setThinkingLevel('Low')));
                    
                    container.parentNode.insertBefore(div, container.nextSibling);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setupFocusListeners() {
        // Global listener to catch manual interactions and refocus
        document.body.addEventListener('click', (e) => {
            const target = e.target;
            
            // 1. Grounding Toggle
            if (target.closest('[data-test-id="searchAsAToolTooltip"] button')) {
                focusMainInput();
                return;
            }

            // 2. Manual Budget Toggle (Gemini 2.5)
            if (target.closest('mat-slide-toggle[data-test-toggle="manual-budget"]')) {
                focusMainInput();
                return;
            }

            // 3. New Chat Link
            if (target.closest('a[href="/prompts/new_chat"]')) {
                setTimeout(runMainLogic, 500);
            }
        }, true); // Capture phase
    }

    // ===================================================================
    // === INIT
    // ===================================================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupFocusListeners();
            injectButtons();
            runMainLogic();
        });
    } else {
        setupFocusListeners();
        injectButtons();
        runMainLogic();
    }

})();