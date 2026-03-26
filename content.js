/**
 * Gemini UI Redesign — Content Script v0.3.0
 * - CSS Custom Properties driven (no inline style.setProperty)
 * - Floating rounded sidebar
 * - Custom background images (from storage or bundled defaults)
 * - Per-zone darkness overlays via CSS vars
 * - Ambient focus glow (CSS-only, no JS caret tracking)
 * - Glassmorphism via CSS vars
 * - Listens for popup changes
 */

(() => {
    'use strict';

    // Guard: if extension was reloaded, old content scripts lose context
    if (!chrome.runtime?.id) return;

    // === ACTIVE STATE (will be updated from storage) ===
    let BG_URL = null;
    let SIDEBAR_BG = null;
    let INPUT_BG = null;
    let MSG_BG = null;
    let BACKGROUNDS_ENABLED = true;
    let HIDE_UPGRADE = false;
    let ZEN_MODE = false;
    let GLASS_INTENSITY = 0;   // 0-100
    let GLASS_BLUR = 24;
    let GLOW_INTENSITY = 0;    // 0-100
    let GLOW_COLOR = '#a855f7';

    // === GRADIENT BACKGROUND ===
    let GRADIENT_PRESET = 'purple-haze';
    let GRADIENT_ANGLE = 135;
    let GRADIENT_INTENSITY = 100;
    let GRADIENT_COLOR_FROM = '#667eea';
    let GRADIENT_COLOR_TO = '#764ba2';

    // === PER-ZONE DARKNESS (0.0 – 0.8) ===
    let DARKNESS_BG = 0.6;
    let DARKNESS_SIDEBAR = 0.6;
    let DARKNESS_INPUT = 0.6;
    let DARKNESS_MSG = 0.6;

    // === LOAD SETTINGS FROM STORAGE ===
    function loadImagesFromStorage(callback) {
        chrome.storage.local.get(
            ['bg_custom', 'sidebar_custom', 'input_custom', 'msg_custom',
                'backgrounds_enabled', 'hide_upgrade', 'zen_mode',
                'glass_intensity', 'glass_blur', 'glow_intensity', 'glow_color',
                'darkness_bg', 'darkness_sidebar', 'darkness_input', 'darkness_msg',
                'gradient_preset', 'gradient_angle', 'gradient_intensity', 'gradient_color_from', 'gradient_color_to'],
            (data) => {
                BACKGROUNDS_ENABLED = data.backgrounds_enabled !== false;
                HIDE_UPGRADE = data.hide_upgrade === true;
                ZEN_MODE = data.zen_mode === true;
                GLASS_INTENSITY = data.glass_intensity ?? 0;
                GLASS_BLUR = data.glass_blur ?? 24;
                GLOW_INTENSITY = data.glow_intensity ?? 0;
                GLOW_COLOR = data.glow_color ?? '#a855f7';

                // Gradient Background
                GRADIENT_PRESET = data.gradient_preset ?? 'purple-haze';
                GRADIENT_ANGLE = data.gradient_angle ?? 135;
                GRADIENT_INTENSITY = data.gradient_intensity ?? 100;
                GRADIENT_COLOR_FROM = data.gradient_color_from ?? '#667eea';
                GRADIENT_COLOR_TO = data.gradient_color_to ?? '#764ba2';

                // Per-zone darkness
                DARKNESS_BG = (data.darkness_bg ?? 60) / 100;
                DARKNESS_SIDEBAR = (data.darkness_sidebar ?? 60) / 100;
                DARKNESS_INPUT = (data.darkness_input ?? 60) / 100;
                DARKNESS_MSG = (data.darkness_msg ?? 60) / 100;

                if (BACKGROUNDS_ENABLED) {
                    BG_URL = data.bg_custom || null;
                    SIDEBAR_BG = data.sidebar_custom || null;
                    INPUT_BG = data.input_custom || null;
                    MSG_BG = data.msg_custom || null;
                } else {
                    BG_URL = null;
                    SIDEBAR_BG = null;
                    INPUT_BG = null;
                    MSG_BG = null;
                }

                if (callback) callback();
            }
        );
    }

    // === INJECT CSS CUSTOM PROPERTIES (single <style> block) ===
    // JS handles state; CSS handles rendering.
    function injectThemeVariables() {
        let style = document.getElementById('gemini-ext-vars');
        if (!style) {
            style = document.createElement('style');
            style.id = 'gemini-ext-vars';
            document.head.appendChild(style);
        }

        const glassOpacity = (GLASS_INTENSITY / 100) * 0.7;
        const glassBlur = (GLASS_INTENSITY / 100) * GLASS_BLUR;
        
        // Build gradient CSS
        let gradientCSS = 'none';
        if (GRADIENT_PRESET !== 'none' && GRADIENT_INTENSITY > 0) {
            gradientCSS = `linear-gradient(${GRADIENT_ANGLE}deg, ${GRADIENT_COLOR_FROM}, ${GRADIENT_COLOR_TO})`;
        }

        style.textContent = `
            :root {
                --gemini-glass-opacity: ${glassOpacity};
                --gemini-glass-blur: ${glassBlur}px;
                --gemini-glow-color: ${GLOW_COLOR};
                --gemini-glow-intensity: ${GLOW_INTENSITY / 100};
                --gemini-darkness-bg: ${DARKNESS_BG};
                --gemini-darkness-sidebar: ${DARKNESS_SIDEBAR};
                --gemini-darkness-input: ${DARKNESS_INPUT};
                --gemini-darkness-msg: ${DARKNESS_MSG};
                --gemini-bg-url: ${BG_URL ? `url("${BG_URL}")` : 'none'};
                --gemini-sidebar-bg: ${SIDEBAR_BG ? `url("${SIDEBAR_BG}")` : 'none'};
                --gemini-input-bg: ${INPUT_BG ? `url("${INPUT_BG}")` : 'none'};
                --gemini-msg-bg: ${MSG_BG ? `url("${MSG_BG}")` : 'none'};
                --gemini-gradient-bg: ${gradientCSS};
                --gemini-gradient-intensity: ${GRADIENT_INTENSITY / 100};
            }
        `;
    }

    // === APPLY BODY CLASSES (CSS handles the rest) ===
    function applyTheme() {
        if (!document.body) return;

        injectThemeVariables();

        // Toggle body classes — CSS rules key off these
        document.body.classList.toggle('gemini-ext-glass', GLASS_INTENSITY > 0);
        document.body.classList.toggle('gemini-ext-glow', GLOW_INTENSITY > 0);
        document.body.classList.toggle('gemini-ext-hide-upgrade', HIDE_UPGRADE);
        document.body.classList.toggle('gemini-zen-mode', ZEN_MODE);
        document.body.classList.toggle('gemini-ext-bg', !!BG_URL);
        document.body.classList.toggle('gemini-ext-sidebar-bg', !!SIDEBAR_BG);
        document.body.classList.toggle('gemini-ext-input-bg', !!INPUT_BG && GLASS_INTENSITY === 0);
        document.body.classList.toggle('gemini-ext-msg-bg', !!MSG_BG);
        document.body.classList.toggle('gemini-ext-gradient', GRADIENT_PRESET !== 'none' && GRADIENT_INTENSITY > 0);
    }

    // === FULL REFRESH ===
    function fullRefresh() {
        loadImagesFromStorage(() => {
            applyTheme();
        });
    }

    // === LISTEN FOR POPUP MESSAGES ===
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'REFRESH_BACKGROUNDS') {
            fullRefresh();
            sendResponse({ ok: true });
        } else if (msg.type === 'TOGGLE_ZEN') {
            document.body.classList.toggle('gemini-zen-mode');
            sendResponse({ ok: true });
        }
    });

    // === INIT ===
    loadImagesFromStorage(() => {
        if (document.body) applyTheme();
        else document.addEventListener('DOMContentLoaded', applyTheme);

        // Re-apply on DOM mutations (Gemini SPA re-renders)
        waitForElement('bard-sidenav', () => {
            startObserver();
            startLoadingObserver();
        });
    });

    // === WAIT FOR ELEMENT ===
    function waitForElement(selector, callback) {
        const el = document.querySelector(selector);
        if (el) { callback(); return; }

        const initObserver = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                initObserver.disconnect();
                callback();
            }
        });
        initObserver.observe(document.body || document.documentElement, {
            childList: true, subtree: true
        });
    }

    // === MUTATION OBSERVER (Loading State) ===
    function startLoadingObserver() {
        const checkLoading = () => {
            // Very simple heuristic: if a message is being streamed, add .is-loading to input
            // Often Gemini disables the input or shows a stop button.
            // Alternatively, if the chat container is completely empty.
            if (!document.body) return;
            const isStreaming = !!document.querySelector('model-response[is-generating]');
            if (isStreaming) {
                document.body.classList.add('is-loading');
            } else {
                document.body.classList.remove('is-loading');
            }
        };
        
        setInterval(checkLoading, 1000); // Poll for streaming status loosely
    }

    // === MUTATION OBSERVER (throttled) ===
    // Only re-injects CSS vars (cheap) on DOM changes
    function startObserver() {
        let pendingRefresh = false;

        const observer = new MutationObserver(() => {
            if (!pendingRefresh) {
                pendingRefresh = true;
                requestAnimationFrame(() => {
                    applyTheme();
                    pendingRefresh = false;
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

})();
