// ==UserScript==
// @name         Gemini Mode Toggle (Thinking/Fast)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a one-click button to toggle between "Thinking with 3 Pro" and "Fast" modes in Google Gemini.
// @author       You
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/bozdemir14/aistudio-userscript/refs/heads/main/gemini-toggle-mode.user.js
// @updateURL    https://raw.githubusercontent.com/bozdemir14/aistudio-userscript/refs/heads/main/gemini-toggle-mode.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Configuration: The IDs provided in your snippets
    const SELECTORS = {
        container: '.leading-actions-wrapper',
        triggerBtn: '[data-test-id="bard-mode-menu-button"]',
        optionThinking: '[data-test-id="bard-mode-option-thinkingwith3pro"]',
        optionFast: '[data-test-id="bard-mode-option-fast"]',
        toolsDrawer: 'toolbox-drawer'
    };

    // SVG Icons for the button (Brain for Thinking, Lightning for Fast)
    const ICON_SVG = `
    <svg height="24" viewBox="0 -960 960 960" width="24" fill="currentColor">
        <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-82v-78q-33-14-56.5-41.5T360-344v-28h80v28q0 17 11.5 28.5T480-304q17 0 28.5-11.5T520-344v-28h80v28q0 57-35.5 98.5T480-202v40h-40Z"/>
    </svg>`;

    function createToggleButton() {
        // Create the button structure mimicking Gemini's native buttons
        const btn = document.createElement('button');
        btn.className = "mdc-button mat-mdc-button-base toolbox-drawer-button toolbox-drawer-button-with-label mat-mdc-button mat-unthemed";
        btn.style.marginLeft = "8px"; // Add a little spacing
        btn.id = "tm-mode-toggle-btn";

        // Inner HTML structure to match the "Tools" button layout
        btn.innerHTML = `
            <span class="mat-mdc-button-persistent-ripple mdc-button__ripple"></span>
            <span class="mat-icon notranslate gds-icon-l toolbox-drawer-button-icon google-symbols mat-ligature-font mat-icon-no-color" style="display:flex; align-items:center;">
                ${ICON_SVG}
            </span>
            <span class="mdc-button__label">
                <span>Toggle Mode</span>
            </span>
            <span class="mat-focus-indicator"></span>
            <span class="mat-mdc-button-touch-target"></span>
            <span class="mat-ripple mat-mdc-button-ripple"></span>
        `;

        btn.onclick = (e) => {
            e.preventDefault();
            toggleMode();
        };

        return btn;
    }

    function toggleMode() {
        const trigger = document.querySelector(SELECTORS.triggerBtn);
        if (!trigger) {
            console.error("Gemini Toggle: Mode dropdown trigger not found.");
            return;
        }

        // 1. Get current text to determine direction
        const currentText = trigger.innerText || "";
        const isCurrentlyThinking = currentText.includes("Thinking");

        // 2. Click the dropdown trigger to open the menu
        trigger.click();

        // 3. Wait for the Angular Material menu to render in the DOM
        setTimeout(() => {
            let targetSelector = isCurrentlyThinking ? SELECTORS.optionFast : SELECTORS.optionThinking;
            let targetOption = document.querySelector(targetSelector);

            if (targetOption) {
                targetOption.click();
                console.log(`Gemini Toggle: Switched to ${isCurrentlyThinking ? "Fast" : "Thinking"}`);
            } else {
                // Fallback: If the specific IDs change, try finding by text
                // This is a safety net
                const allItems = document.querySelectorAll('.mat-mdc-menu-item');
                for (let item of allItems) {
                    if (isCurrentlyThinking && item.innerText.includes("Fast")) {
                        item.click();
                        break;
                    } else if (!isCurrentlyThinking && item.innerText.includes("Thinking")) {
                        item.click();
                        break;
                    }
                }
                // Close menu if we failed to find target (clicking body usually closes it)
                if (!targetOption) document.body.click();
            }
        }, 50); // 50ms delay is usually sufficient for DOM rendering
    }

    function init() {
        // Use a MutationObserver to watch for the chat interface loading
        const observer = new MutationObserver((mutations) => {
            const container = document.querySelector(SELECTORS.container);
            
            // If container exists and our button doesn't exist yet
            if (container && !document.getElementById('tm-mode-toggle-btn')) {
                const btn = createToggleButton();
                
                // We want to append it to the leading actions wrapper
                // The snippets show `uploader` and `toolbox-drawer` are inside this wrapper.
                // We append to the end of the wrapper so it sits next to Tools.
                container.appendChild(btn);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Start the script
    init();

})();