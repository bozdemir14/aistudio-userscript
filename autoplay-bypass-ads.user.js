// ==UserScript==
// @name         Auto-Play & Unblock Site
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Disables right-click block, clicks initial play, skips ad, and plays the main video.
// @author       You
// @include      *://*macizlevip*.shop/*
// @include      *://*mactanmaca179.shop/*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/bozdemir14/aistudio-userscript/refs/heads/main/autoplay-bypass-ads.user.js
// @updateURL    https://raw.githubusercontent.com/bozdemir14/aistudio-userscript/refs/heads/main/autoplay-bypass-ads.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. Disable Right-Click Blocker ---
    // Rationale: The <body> tag has an oncontextmenu="return !1" attribute.
    // Setting this property to null immediately removes the block.
    document.body.oncontextmenu = null;
    console.log('Tampermonkey: Right-click protection disabled.');

    // --- 2. Automate the Play Sequence ---
    let state = 'IDLE'; // Tracks progress: IDLE -> CLICKED_PLAY -> SKIPPED_AD -> PLAYING

    const interval = setInterval(() => {
        // State 1: Find and click the initial play button overlay.
        if (state === 'IDLE') {
            const initialPlayButton = document.querySelector('div[data-player] .play-wrapper');
            if (initialPlayButton) {
                console.log('Tampermonkey: Found initial play overlay. Clicking...');
                initialPlayButton.click();
                state = 'CLICKED_PLAY';
            }
        }

        // State 2: After the ad starts, wait for the skip function to appear.
        if (state === 'CLICKED_PLAY' && window.app && typeof window.app.skip === 'function') {
            console.log('Tampermonkey: Ad skip function found. Skipping...');
            window.app.skip();
            state = 'SKIPPED_AD';
        }

        // State 3: After skipping, wait for the main player and play the video.
        if (state === 'SKIPPED_AD' && window.app?.clappr?.instance?.play) {
            console.log('Tampermonkey: Main player found. Playing video...');
            const player = window.app.clappr.instance;
            player.unmute();
            player.play();

            state = 'PLAYING'; // Final state
            clearInterval(interval); // Stop the script
            console.log('Tampermonkey: Script finished.');
        }
    }, 250); // Check every 250ms

    // Failsafe: Stop checking after 15 seconds.
    setTimeout(() => clearInterval(interval), 15000);
})();