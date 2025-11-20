// ==UserScript==
// @name        AI Studio Mobile V14
// @match       https://aistudio.google.com/*
// @version     14.0
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    // === CONFIGURATION ===
    const MODELS = {
        PRO:   ['gemini-2.0-pro-exp', 'gemini-1.5-pro-002', 'gemini-1.5-pro'],
        FLASH: ['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash-002']
    };

    // Simplified prompt to avoid encoding errors on iOS
    const SYSTEM_PROMPT = `You are a concise, expert-level assistant.

Interaction Rules:
- Clarify first: If ambiguous, ask questions.
- Inference rule: If minor ambiguity, assume and proceed.
- Offer alternatives: Note trade-offs.
- Explain reasoning: Short rationale for code.
- Handle impossibility: State clearly if impossible.

Response Formatting:
- Start with a 1-2 sentence summary.
- Break down complex problems into steps.
- Use lists and tables.
- Keep explanations tight.

Tone:
- Direct, professional, confident.
- Never mention being an AI.
- Blunt clarity over politeness.`;

    // === STYLES ===
    const style = document.createElement('style');
    style.textContent = `
        body.script-busy .cdk-overlay-container { opacity: 0 !important; }
        
        .as-mob-btn {
            padding: 4px 10px;
            margin-left: 8px;
            border-radius: 12px;
            border: 1px solid #555;
            background: rgba(0,0,0,0.1);
            color: white;
            font-size: 12px;
            white-space: nowrap;
            z-index: 9999;
        }
        
        /* Force Title Row Horizontal */
        .page-title {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
        }

        .as-header-group { display: flex; align-items: center; }

        @media (min-width: 900px) { .as-header-group { display: none; } }
    `;
    document.head.appendChild(style);

    // === UTILS ===
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    
    function click(el) {
        if(el) {
            el.click();
        }
    }

    // === ACTIONS ===
    async function openSidebarIfNeeded() {
        const selector = document.querySelector('.model-selector-card');
        // Check if visible
        if (!selector || selector.offsetParent === null) {
            const tuneBtn = document.querySelector('button[aria-label="Toggle run settings panel"]');
            if(tuneBtn) {
                click(tuneBtn);
                await wait(700); // Mobile animation is slow
                return true; // We opened it
            }
        }
        return false; // Was already open
    }

    async function setPrompt() {
        // Only try if sidebar is accessible
        const openBtn = document.querySelector('button[data-test-system-instructions-card]');
        if(openBtn && !openBtn.querySelector('.has-content')) {
            click(openBtn);
            await wait(500);
            const area = document.querySelector('textarea[aria-label="System instructions"]');
            if(area) {
                area.value = SYSTEM_PROMPT;
                area.dispatchEvent(new Event('input', {bubbles:true}));
                await wait(200);
                // Close overlay
                const bg = document.querySelector('.cdk-overlay-backdrop');
                if(bg) click(bg);
            }
        }
    }

    async function selectModel(modelList) {
        document.body.classList.add('script-busy');
        
        const opened = await openSidebarIfNeeded();

        const selector = document.querySelector('.model-selector-card');
        if(selector) {
            click(selector);
            await wait(600);

            let target = null;
            const btns = Array.from(document.querySelectorAll('ms-model-carousel-row button'));
            
            for(const m of modelList) {
                target = document.getElementById('model-carousel-row-models/' + m) || 
                         btns.find(b => b.textContent.includes(m));
                if(target) break;
            }

            if(target) {
                click(target);
                await wait(500);
            }

            const bg = document.querySelector('.cdk-overlay-backdrop');
            if(bg) click(bg);
        }

        if(opened) {
            const tuneBtn = document.querySelector('button[aria-label="Toggle run settings panel"]');
            if(tuneBtn) click(tuneBtn);
        }

        document.body.classList.remove('script-busy');
    }

    // === WATCHDOG ===
    let lastUrl = location.href;
    
    const observer = new MutationObserver(() => {
        // URL Change
        if(location.href !== lastUrl) {
            lastUrl = location.href;
            if(location.href.includes('/new_chat')) {
                setTimeout(() => {
                    openSidebarIfNeeded().then((opened) => {
                         setPrompt().then(() => {
                             if(opened) {
                                 const tuneBtn = document.querySelector('button[aria-label="Toggle run settings panel"]');
                                 if(tuneBtn) click(tuneBtn);
                             }
                         });
                    });
                }, 1000);
            }
        }

        // Inject Buttons
        const title = document.querySelector('.page-title');
        if(title && !title.querySelector('.as-header-group')) {
            const div = document.createElement('div');
            div.className = 'as-header-group';
            
            const b1 = document.createElement('button');
            b1.className = 'as-mob-btn';
            b1.textContent = 'Pro';
            b1.ontouchstart = (e) => { e.stopPropagation(); selectModel(MODELS.PRO); };
            b1.onclick = (e) => { e.preventDefault(); e.stopPropagation(); selectModel(MODELS.PRO); };
            
            const b2 = document.createElement('button');
            b2.className = 'as-mob-btn';
            b2.textContent = 'Flash';
            b2.ontouchstart = (e) => { e.stopPropagation(); selectModel(MODELS.FLASH); };
            b2.onclick = (e) => { e.preventDefault(); e.stopPropagation(); selectModel(MODELS.FLASH); };

            div.appendChild(b1);
            div.appendChild(b2);
            title.appendChild(div);
        }
    });

    observer.observe(document.body, {childList: true, subtree: true});
})();