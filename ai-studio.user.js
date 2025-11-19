// ==UserScript==
// @name         AI Studio Advanced Settings (Zero-Flash & Flexible Models)
// @namespace    http://tampermonkey.net/
// @version      7.4
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
        PRO:   ['gemini-3-pro', 'gemini-3-pro-latest', 'gemini-3-pro-preview', 'gemini-2.5-pro'],
        // Updated order: 3 > Flash Latest > 2.5
        FLASH: ['gemini-3-flash-latest', 'gemini-3-flash', 'gemini-3-flash-preview', 'gemini-flash-latest', 'gemini-2.5-flash'],
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

    // State tracking
    let isBusy = false;
    let lastUrl = location.href;

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
        .as-custom-btn {
            padding: 4px 10px; cursor: pointer; border-radius: 16px; 
            border: 1px solid #555; background: none; 
            color: var(--mat-sys-on-surface); font-size: 13px;
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
            }, 50);
        }
    }

    function focusMainInput() {
        setTimeout(() => {
            const el = document.querySelector('textarea[aria-label="Type something or tab to choose an example prompt"], textarea[aria-label="Start typing a prompt"]');
            if (el) {
                el.focus();
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
        
        // Only run main logic automatically if we are in a New Chat context
        // or if specific params are present.
        if (!location.href.includes('/new_chat') && !location.search.includes('model=')) {
            return;
        }

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

            waitForElement('button[id*="model-carousel-row-models"]', () => {
                // 20ms buffer for Safari painting
                setTimeout(() => {
                    let targetBtn = null;

                    // Strategy A: Exact ID Match
                    for (const modelId of candidateList) {
                        targetBtn = document.getElementById(`model-carousel-row-models/${modelId}`);
                        if (targetBtn) {
                            console.log(`[Tampermonkey] Found via ID: ${modelId}`);
                            break;
                        }
                    }

                    // Strategy B: Fallback text scan
                    if (!targetBtn) {
                        const allButtons = Array.from(document.querySelectorAll('ms-model-carousel-row button'));
                        for (const modelId of candidateList) {
                            targetBtn = allButtons.find(b => b.textContent.includes(modelId));
                            if (targetBtn) {
                                console.log(`[Tampermonkey] Found via Text: ${modelId}`);
                                break;
                            }
                        }
                    }

                    if (targetBtn) {
                        targetBtn.click();
                    } else {
                        console.warn("[Tampermonkey] No model found from list:", candidateList);
                        const backdrop = document.querySelector('.cdk-overlay-backdrop');
                        if (backdrop) backdrop.click();
                    }

                    setTimeout(() => {
                        const backdrop = document.querySelector('.cdk-overlay-backdrop');
                        if (backdrop) backdrop.click();
                        setTimeout(resolve, 150);
                    }, 50);

                }, 20); 
            }, 3000);
        });
    }

    function setSystemPrompt(promptText) {
        return new Promise(resolve => {
            const openBtn = document.querySelector('button[data-test-system-instructions-card]');
            if (!openBtn) { resolve(); return; }
            if (openBtn.querySelector('[class*="has-content"]')) { resolve(); return; }

            openBtn.click();
            waitForElement('textarea[aria-label="System instructions"]', (textArea) => {
                textArea.value = promptText;
                textArea.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(() => {
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop) backdrop.click();
                    setTimeout(resolve, 150);
                }, 150);
            });
        });
    }

    function setThinkingBudget(val) {
        const thinkingToggle = document.querySelector('mat-slide-toggle[data-test-toggle="enable-thinking"] button');
        if (thinkingToggle && thinkingToggle.getAttribute('aria-checked') === 'false') {
            thinkingToggle.click();
        }
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

    async function setThinkingLevel(level) {
        const select = document.querySelector('mat-select[aria-label="Thinking Level"]');
        if (!select) return;
        if (select.textContent.includes(level)) { focusMainInput(); return; }

        toggleAutomationMode(true);
        select.click();
        waitForElement('.cdk-overlay-pane mat-option', () => {
            const options = document.querySelectorAll('mat-option');
            for (const opt of options) {
                if (opt.textContent.includes(level)) { opt.click(); break; }
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
    // === WATCHDOG & UI INJECTION (SPA SUPPORT)
    // ===================================================================

    function createBtn(text, onClick) {
        const b = document.createElement('button');
        b.textContent = text;
        b.className = 'as-custom-btn';
        b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
        return b;
    }

    // Persistent Observer to handle SPA navigation and UI updates
    function startWatchdog() {
        const observer = new MutationObserver(() => {
            // 1. Check for URL Changes
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                console.log("[Tampermonkey] URL Changed, checking logic...");
                // If we navigated to a new chat, run logic
                if (location.href.includes('/new_chat')) {
                    setTimeout(runMainLogic, 500);
                }
            }

            // 2. Inject Model Buttons (Persistent)
            const modelSelector = document.querySelector('.settings-item.settings-model-selector');
            if (modelSelector && !modelSelector.parentNode.querySelector('.model-switch-buttons')) {
                const div = document.createElement('div');
                div.className = 'model-switch-buttons as-btn-group';
                
                div.appendChild(createBtn('Pro', async () => {
                    toggleAutomationMode(true); await selectBestModel(MODEL_PREFS.PRO); toggleAutomationMode(false); focusMainInput();
                }));
                div.appendChild(createBtn('Flash', async () => {
                    toggleAutomationMode(true); await selectBestModel(MODEL_PREFS.FLASH); toggleAutomationMode(false); focusMainInput();
                }));
                div.appendChild(createBtn('Nano', async () => {
                    toggleAutomationMode(true); await selectBestModel(MODEL_PREFS.NANO); toggleAutomationMode(false); focusMainInput();
                }));
                modelSelector.parentNode.insertBefore(div, modelSelector.nextSibling);
            }

            // 3. Inject Thinking Buttons (Persistent)
            const headers = Array.from(document.querySelectorAll('h3.item-description-title'));
            const thinkingHeader = headers.find(h => h.textContent.trim() === 'Thinking level');
            if (thinkingHeader) {
                const container = thinkingHeader.closest('.settings-item');
                if (container && !container.nextElementSibling?.classList.contains('thinking-level-buttons')) {
                    const div = document.createElement('div');
                    div.className = 'thinking-level-buttons as-btn-group';
                    div.style.marginLeft = '16px'; 
                    div.appendChild(createBtn('High', () => setThinkingLevel('High')));
                    div.appendChild(createBtn('Low', () => setThinkingLevel('Low')));
                    container.parentNode.insertBefore(div, container.nextSibling);
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function setupGlobalListeners() {
        document.body.addEventListener('click', (e) => {
            // Manual Focus handling
            if (e.target.closest('[data-test-id="searchAsAToolTooltip"] button') || 
                e.target.closest('mat-slide-toggle[data-test-toggle="manual-budget"]')) {
                focusMainInput();
            }
            // Fallback for "New Chat" click if URL observer misses it
            if (e.target.closest('a[href="/prompts/new_chat"]')) {
                setTimeout(runMainLogic, 500);
            }
        }, true);
    }

    // ===================================================================
    // === INIT
    // ===================================================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { 
            setupGlobalListeners(); 
            startWatchdog();
            // Run logic once in case we landed directly on /new_chat
            runMainLogic();
        });
    } else {
        setupGlobalListeners();
        startWatchdog();
        runMainLogic();
    }

})();