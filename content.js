/**
 * Gemini UI Redesign — Content Script v0.5.0
 * - High-performance local state cache (single storage fetch)
 * - Optimized dual MutationObserver strategy
 * - IntersectionObserver for viewport-aware effects
 * - CSS Custom Properties driven (no inline style.setProperty)
 * - GPU-accelerated animations & transitions
 * - Floating rounded sidebar
 * - Custom background images (from storage or bundled defaults)
 * - Per-zone darkness overlays via CSS vars
 * - Ambient focus glow (CSS-only, no JS caret tracking)
 * - Glassmorphism via CSS vars
 * - Multiple gradient presets (default, sunset, ocean, aurora, neon, forest, midnight)
 */

(() => {
    'use strict';

    // Guard: if extension was reloaded, old content scripts lose context
    if (!chrome.runtime?.id) return;

    // === LOCAL STATE CACHE (avoids repeated async storage calls) ===
    const stateCache = {
        bgUrl: null,
        sidebarBg: null,
        inputBg: null,
        msgBg: null,
        backgroundsEnabled: true,
        hideUpgrade: false,
        zenMode: false,
        glassIntensity: 0,
        glassBlur: 24,
        glowIntensity: 0,
        glowColor: '#a855f7',
        darknessBg: 0.6,
        darknessSidebar: 0.6,
        darknessInput: 0.6,
        darknessMsg: 0.6,
        gradientPreset: 'default' // default, sunset, ocean, aurora, neon, forest, midnight
    };

    // === LOAD SETTINGS FROM STORAGE (single fetch, populate cache) ===
    function loadStateFromStorage(callback) {
        chrome.storage.local.get([
            'bg_custom', 'sidebar_custom', 'input_custom', 'msg_custom',
            'backgrounds_enabled', 'hide_upgrade', 'zen_mode',
            'glass_intensity', 'glass_blur', 'glow_intensity', 'glow_color',
            'darkness_bg', 'darkness_sidebar', 'darkness_input', 'darkness_msg',
            'gradient_preset'
        ], (data) => {
            // Update cache
            stateCache.backgroundsEnabled = data.backgrounds_enabled !== false;
            stateCache.hideUpgrade = data.hide_upgrade === true;
            stateCache.zenMode = data.zen_mode === true;
            stateCache.glassIntensity = data.glass_intensity ?? 0;
            stateCache.glassBlur = data.glass_blur ?? 24;
            stateCache.glowIntensity = data.glow_intensity ?? 0;
            stateCache.glowColor = data.glow_color ?? '#a855f7';
            stateCache.gradientPreset = data.gradient_preset ?? 'default';

            // Per-zone darkness (convert 0-100 to 0.0-1.0)
            stateCache.darknessBg = (data.darkness_bg ?? 60) / 100;
            stateCache.darknessSidebar = (data.darkness_sidebar ?? 60) / 100;
            stateCache.darknessInput = (data.darkness_input ?? 60) / 100;
            stateCache.darknessMsg = (data.darkness_msg ?? 60) / 100;

            // Background URLs (only if enabled)
            if (stateCache.backgroundsEnabled) {
                stateCache.bgUrl = data.bg_custom || null;
                stateCache.sidebarBg = data.sidebar_custom || null;
                stateCache.inputBg = data.input_custom || null;
                stateCache.msgBg = data.msg_custom || null;
            } else {
                stateCache.bgUrl = null;
                stateCache.sidebarBg = null;
                stateCache.inputBg = null;
                stateCache.msgBg = null;
            }

            if (callback) callback();
        });
    }

    // === INJECT CSS CUSTOM PROPERTIES (single <style> block) ===
    // JS handles state; CSS handles rendering. Reads from local cache.
    function injectThemeVariables() {
        let style = document.getElementById('gemini-ext-vars');
        if (!style) {
            style = document.createElement('style');
            style.id = 'gemini-ext-vars';
            document.head.appendChild(style);
        }

        const glassOpacity = (stateCache.glassIntensity / 100) * 0.7;
        const glassBlur = (stateCache.glassIntensity / 100) * stateCache.glassBlur;

        // Gradient preset colors
        const gradientPresets = {
            default: { mesh1: '#4f46e5', mesh2: '#c026d3', mesh3: '#0891b2' }, // Indigo, Fuchsia, Cyan
            sunset: { mesh1: '#f97316', mesh2: '#ec4899', mesh3: '#a855f7' }, // Orange, Pink, Purple
            ocean: { mesh1: '#0ea5e9', mesh2: '#14b8a6', mesh3: '#22c55e' }, // Sky, Teal, Green
            aurora: { mesh1: '#22c55e', mesh2: '#14b8a6', mesh3: '#3b82f6' }, // Green, Teal, Blue
            neon: { mesh1: '#f43f5e', mesh2: '#8b5cf6', mesh3: '#06b6d4' }, // Rose, Violet, Cyan
            forest: { mesh1: '#166534', mesh2: '#15803d', mesh3: '#84cc16' }, // Dark Green, Green, Lime
            midnight: { mesh1: '#1e3a8a', mesh2: '#4c1d95', mesh3: '#581c87' } // Navy, Deep Purple, Purple
        };

        const preset = gradientPresets[stateCache.gradientPreset] || gradientPresets.default;

        style.textContent = `
            :root {
                --gemini-glass-opacity: ${glassOpacity};
                --gemini-glass-blur: ${glassBlur}px;
                --gemini-glow-color: ${stateCache.glowColor};
                --gemini-glow-intensity: ${stateCache.glowIntensity / 100};
                --gemini-darkness-bg: ${stateCache.darknessBg};
                --gemini-darkness-sidebar: ${stateCache.darknessSidebar};
                --gemini-darkness-input: ${stateCache.darknessInput};
                --gemini-darkness-msg: ${stateCache.darknessMsg};
                --gemini-bg-url: ${stateCache.bgUrl ? `url("${stateCache.bgUrl}")` : 'none'};
                --gemini-sidebar-bg: ${stateCache.sidebarBg ? `url("${stateCache.sidebarBg}")` : 'none'};
                --gemini-input-bg: ${stateCache.inputBg ? `url("${stateCache.inputBg}")` : 'none'};
                --gemini-msg-bg: ${stateCache.msgBg ? `url("${stateCache.msgBg}")` : 'none'};
                --gemini-mesh-1: ${preset.mesh1};
                --gemini-mesh-2: ${preset.mesh2};
                --gemini-mesh-3: ${preset.mesh3};
            }
        `;
    }

    // === APPLY BODY CLASSES (CSS handles the rest) ===
    function applyTheme() {
        if (!document.body) return;

        injectThemeVariables();

        // Toggle body classes — CSS rules key off these
        document.body.classList.toggle('gemini-ext-glass', stateCache.glassIntensity > 0);
        document.body.classList.toggle('gemini-ext-glow', stateCache.glowIntensity > 0);
        document.body.classList.toggle('gemini-ext-hide-upgrade', stateCache.hideUpgrade);
        document.body.classList.toggle('gemini-zen-mode', stateCache.zenMode);
        document.body.classList.toggle('gemini-ext-bg', !!stateCache.bgUrl);
        document.body.classList.toggle('gemini-ext-sidebar-bg', !!stateCache.sidebarBg);
        document.body.classList.toggle('gemini-ext-input-bg', !!stateCache.inputBg && stateCache.glassIntensity === 0);
        document.body.classList.toggle('gemini-ext-msg-bg', !!stateCache.msgBg);
    }

    // === FULL REFRESH (re-fetch from storage, update cache, reapply) ===
    function fullRefresh() {
        loadStateFromStorage(() => {
            applyTheme();
        });
    }

    // === LISTEN FOR POPUP MESSAGES ===
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === 'REFRESH_BACKGROUNDS') {
            fullRefresh();
            sendResponse({ ok: true });
        } else if (msg.type === 'TOGGLE_ZEN') {
            stateCache.zenMode = !stateCache.zenMode;
            document.body.classList.toggle('gemini-zen-mode', stateCache.zenMode);
            sendResponse({ ok: true });
        } else if (msg.type === 'SET_GRADIENT') {
            stateCache.gradientPreset = msg.preset || 'default';
            injectThemeVariables();
            sendResponse({ ok: true });
        }
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

    // === MUTATION OBSERVER (Loading State - lightweight polling) ===
    function startLoadingObserver() {
        const checkLoading = () => {
            if (!document.body) return;
            const isStreaming = !!document.querySelector('model-response[is-generating]');
            document.body.classList.toggle('is-loading', isStreaming);
        };
        
        setInterval(checkLoading, 1000); // Loose polling for streaming status
    }

    // === MUTATION OBSERVER #1: Main chat container (message bubbles only) ===
    // Optimized: only watches the chat area where messages appear
    function startChatObserver() {
        let pendingRefresh = false;
        const chatContainer = document.querySelector('.conversation-container');
        if (!chatContainer) return;

        const chatObserver = new MutationObserver(() => {
            if (!pendingRefresh) {
                pendingRefresh = true;
                requestAnimationFrame(() => {
                    injectThemeVariables(); // Only update CSS vars, skip class toggles
                    pendingRefresh = false;
                });
            }
        });

        chatObserver.observe(chatContainer, {
            childList: true,
            subtree: true
        });
    }

    // === MUTATION OBSERVER #2: Persistent elements (sidebar, etc.) ===
    // One-time observer for static UI elements that rarely change
    function startPersistentObserver() {
        const sidebar = document.querySelector('bard-sidenav');
        if (!sidebar) return;

        const persistentObserver = new MutationObserver(() => {
            // Only re-apply theme if sidebar structure changes significantly
            injectThemeVariables();
        });

        persistentObserver.observe(sidebar, {
            childList: true,
            attributes: true,
            subtree: false
        });
    }

    // === INTERSECTION OBSERVER (viewport-aware glassmorphism) ===
    // Only apply heavy effects to visible elements
    function setupIntersectionObserver() {
        if (!('IntersectionObserver' in window)) return;

        const glassElements = document.querySelectorAll('input-area-v2, .user-query-bubble-with-background');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                entry.target.classList.toggle('in-viewport', entry.isIntersecting);
            });
        }, { threshold: 0.1 });

        glassElements.forEach(el => io.observe(el));
    }

    // === INIT ===
    loadStateFromStorage(() => {
        if (document.body) applyTheme();
        else document.addEventListener('DOMContentLoaded', applyTheme);

        // Wait for key elements, then set up optimized observers
        waitForElement('bard-sidenav', () => {
            startLoadingObserver();
            startPersistentObserver();
        });

        waitForElement('.conversation-container', () => {
            startChatObserver();
            setupIntersectionObserver();
        });
    });

})();
