/**
 * Gemini UI Redesign — Popup v0.3.0
 * Per-zone darkness sliders + drag & drop + storage + auto-reload
 */

(() => {
    'use strict';

    const KEYS = ['bg_custom', 'sidebar_custom', 'input_custom', 'msg_custom'];
    const DARKNESS_KEYS = ['darkness_bg', 'darkness_sidebar', 'darkness_input', 'darkness_msg'];
    const ZONE_IDS = ['zone-bg', 'zone-sidebar', 'zone-input', 'zone-msg'];
    const PREVIEW_IDS = ['preview-bg', 'preview-sidebar', 'preview-input', 'preview-msg'];

    const toggleInput = document.getElementById('toggle-backgrounds');
    const toggleHideUpgrade = document.getElementById('toggle-hide-upgrade');
    const toggleZenMode = document.getElementById('toggle-zen-mode');
    
    // Glass & Glow elements
    const glassIntensity = document.getElementById('glass-intensity');
    const glassIntensityValue = document.getElementById('glass-intensity-value');
    const glassBlurSlider = document.getElementById('glass-blur-slider');
    const glassBlurValue = document.getElementById('glass-blur-value');
    const glassBlurRow = document.getElementById('glass-blur-row');
    const glowIntensity = document.getElementById('glow-intensity');
    const glowIntensityValue = document.getElementById('glow-intensity-value');
    const glowColorRow = document.getElementById('glow-color-row');
    const glowPresets = document.getElementById('glow-presets');
    const glowColorCustom = document.getElementById('glow-color-custom');
    const zonesContainer = document.getElementById('zones-container');

    // Gradient Background elements
    const gradientPresets = document.getElementById('gradient-presets');
    const gradientControlsRow = document.getElementById('gradient-controls-row');
    const gradientAngle = document.getElementById('gradient-angle');
    const gradientAngleValue = document.getElementById('gradient-angle-value');
    const gradientIntensity = document.getElementById('gradient-intensity');
    const gradientIntensityValue = document.getElementById('gradient-intensity-value');
    const gradientColorFrom = document.getElementById('gradient-color-from');
    const gradientColorTo = document.getElementById('gradient-color-to');
    const btnApplyCustomGradient = document.getElementById('btn-apply-custom-gradient');

    // All per-zone darkness sliders
    const darknessSliders = document.querySelectorAll('.darkness-slider');

    // === LOAD STATE ===
    function loadState() {
        chrome.storage.local.get([...KEYS, ...DARKNESS_KEYS, 'backgrounds_enabled', 'hide_upgrade', 'zen_mode',
            'glass_intensity', 'glass_blur', 'glow_intensity', 'glow_color',
            'gradient_preset', 'gradient_angle', 'gradient_intensity', 'gradient_color_from', 'gradient_color_to'], (data) => {
            // Toggle
            const enabled = data.backgrounds_enabled !== false;
            toggleInput.checked = enabled;
            updateDisabledState(enabled);

            // Hide Upgrade toggle
            toggleHideUpgrade.checked = data.hide_upgrade === true;

            // Zen Mode toggle
            toggleZenMode.checked = data.zen_mode === true;

            // Glass intensity (0-100)
            const gi = data.glass_intensity ?? 0;
            glassIntensity.value = gi;
            glassIntensityValue.textContent = gi + '%';
            updateBlurRowState(gi > 0);

            const blur = data.glass_blur ?? 24;
            glassBlurSlider.value = blur;
            glassBlurValue.textContent = blur + 'px';

            // Glow
            const glowI = data.glow_intensity ?? 0;
            glowIntensity.value = glowI;
            glowIntensityValue.textContent = glowI + '%';
            updateGlowColorState(glowI > 0);

            const glowC = data.glow_color ?? '#a855f7';
            glowColorCustom.value = glowC;
            setActivePreset(glowC);

            // Gradient Background
            const gradientPreset = data.gradient_preset ?? 'purple-haze';
            setActiveGradientPreset(gradientPreset);

            const gradAngle = data.gradient_angle ?? 135;
            gradientAngle.value = gradAngle;
            gradientAngleValue.textContent = gradAngle + '°';

            const gradIntensity = data.gradient_intensity ?? 100;
            gradientIntensity.value = gradIntensity;
            gradientIntensityValue.textContent = gradIntensity + '%';

            const gradColorFrom = data.gradient_color_from ?? '#667eea';
            gradientColorFrom.value = gradColorFrom;

            const gradColorTo = data.gradient_color_to ?? '#764ba2';
            gradientColorTo.value = gradColorTo;

            updateGradientControlsState(gradientPreset !== 'none');

            // Per-zone darkness sliders
            darknessSliders.forEach(slider => {
                const key = slider.dataset.target;
                const val = data[key] ?? 60;
                slider.value = val;
                slider.nextElementSibling.textContent = val + '%';
            });

            // Previews
            KEYS.forEach((key, i) => {
                if (data[key]) {
                    showPreview(ZONE_IDS[i], PREVIEW_IDS[i], data[key]);
                }
            });
        });
    }

    function updateBlurRowState(enabled) {
        if (enabled) {
            glassBlurRow.classList.remove('disabled');
        } else {
            glassBlurRow.classList.add('disabled');
        }
    }

    function updateGlowColorState(enabled) {
        if (enabled) {
            glowColorRow.classList.remove('disabled');
        } else {
            glowColorRow.classList.add('disabled');
        }
    }

    function updateGradientControlsState(enabled) {
        if (enabled) {
            gradientControlsRow.classList.remove('disabled');
        } else {
            gradientControlsRow.classList.add('disabled');
        }
    }

    function setActiveGradientPreset(presetName) {
        gradientPresets.querySelectorAll('.gradient-preset').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.gradient === presetName);
        });
    }

    // Gradient presets configuration
    const GRADIENT_PRESETS = {
        'none': { from: '#27272a', to: '#18181b' },
        'sunset': { from: '#f093fb', to: '#f5576c' },
        'ocean': { from: '#4facfe', to: '#00f2fe' },
        'forest': { from: '#d4fc79', to: '#96e6a1' },
        'purple-haze': { from: '#667eea', to: '#764ba2' },
        'midnight': { from: '#2c3e50', to: '#4ca1af' },
        'fire': { from: '#f12711', to: '#f5af19' },
        'rainbow': { from: '#ff9a9e', to: '#fecfef' }
    };

    function getGradientCSS(from, to, angle, intensity) {
        if (intensity === 0) return null;
        const opacity = intensity / 100;
        return `linear-gradient(${angle}deg, ${from}, ${to})`;
    }

    function setActivePreset(color) {
        glowPresets.querySelectorAll('.color-dot').forEach(dot => {
            dot.classList.toggle('active', dot.dataset.color === color);
        });
    }

    function updateDisabledState(enabled) {
        if (enabled) {
            zonesContainer.classList.remove('disabled');
        } else {
            zonesContainer.classList.add('disabled');
        }
    }

    function showPreview(zoneId, previewId, dataUrl) {
        const zone = document.getElementById(zoneId);
        const preview = document.getElementById(previewId);
        preview.style.backgroundImage = `url("${dataUrl}")`;
        zone.classList.add('has-image');
    }

    function clearPreview(zoneId, previewId) {
        const zone = document.getElementById(zoneId);
        const preview = document.getElementById(previewId);
        preview.style.backgroundImage = '';
        zone.classList.remove('has-image');
    }

    // === FILE HANDLING ===
    function handleFile(file, index) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 800;  // Reduced from 1920 — prevents storage quota errors
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/webp', 0.65);

                chrome.storage.local.set({ [KEYS[index]]: dataUrl }, () => {
                    if (chrome.runtime.lastError) {
                        alert('Image too large for storage. Try a smaller image.\n' + chrome.runtime.lastError.message);
                        return;
                    }
                    showPreview(ZONE_IDS[index], PREVIEW_IDS[index], dataUrl);
                    refreshGeminiTabs();
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // === REFRESH GEMINI TABS ===
    function refreshGeminiTabs() {
        chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, { type: 'REFRESH_BACKGROUNDS' }, (response) => {
                    if (chrome.runtime.lastError) {
                        chrome.tabs.reload(tab.id);
                    }
                });
            });
        });
    }

    // === SETUP DROP ZONES ===
    ZONE_IDS.forEach((zoneId, index) => {
        const zone = document.getElementById(zoneId);
        const fileInput = zone.querySelector('.zone-input');
        const resetBtn = zone.querySelector('.zone-reset');

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file, index);
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFile(file, index);
            fileInput.value = '';
        });

        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            chrome.storage.local.remove(KEYS[index], () => {
                clearPreview(zoneId, PREVIEW_IDS[index]);
                refreshGeminiTabs();
            });
        });
    });

    // === TOGGLE ===
    toggleInput.addEventListener('change', () => {
        const enabled = toggleInput.checked;
        chrome.storage.local.set({ backgrounds_enabled: enabled }, () => {
            updateDisabledState(enabled);
            refreshGeminiTabs();
        });
    });

    // === HIDE UPGRADE TOGGLE ===
    toggleHideUpgrade.addEventListener('change', () => {
        const hide = toggleHideUpgrade.checked;
        chrome.storage.local.set({ hide_upgrade: hide }, () => {
            refreshGeminiTabs();
        });
    });

    // === ZEN MODE TOGGLE ===
    toggleZenMode.addEventListener('change', () => {
        const zen = toggleZenMode.checked;
        chrome.storage.local.set({ zen_mode: zen }, () => {
            chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_ZEN' });
                });
            });
        });
    });

    // === GLASS INTENSITY SLIDER ===
    glassIntensity.addEventListener('input', () => {
        glassIntensityValue.textContent = parseInt(glassIntensity.value) + '%';
    });

    glassIntensity.addEventListener('change', () => {
        const val = parseInt(glassIntensity.value);
        updateBlurRowState(val > 0);
        chrome.storage.local.set({ glass_intensity: val }, () => {
            refreshGeminiTabs();
        });
    });

    // === GLASS BLUR SLIDER ===
    glassBlurSlider.addEventListener('input', () => {
        glassBlurValue.textContent = parseInt(glassBlurSlider.value) + 'px';
    });

    glassBlurSlider.addEventListener('change', () => {
        const val = parseInt(glassBlurSlider.value);
        chrome.storage.local.set({ glass_blur: val }, () => {
            refreshGeminiTabs();
        });
    });

    // === GLOW INTENSITY SLIDER ===
    glowIntensity.addEventListener('input', () => {
        glowIntensityValue.textContent = parseInt(glowIntensity.value) + '%';
    });

    glowIntensity.addEventListener('change', () => {
        const val = parseInt(glowIntensity.value);
        updateGlowColorState(val > 0);
        chrome.storage.local.set({ glow_intensity: val }, () => {
            refreshGeminiTabs();
        });
    });

    // === GLOW COLOR PRESETS ===
    glowPresets.querySelectorAll('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const color = dot.dataset.color;
            setActivePreset(color);
            glowColorCustom.value = color;
            chrome.storage.local.set({ glow_color: color }, () => {
                refreshGeminiTabs();
            });
        });
    });

    // === GLOW CUSTOM COLOR ===
    glowColorCustom.addEventListener('input', () => {
        const color = glowColorCustom.value;
        setActivePreset(color);
        chrome.storage.local.set({ glow_color: color }, () => {
            refreshGeminiTabs();
        });
    });

    // === PER-ZONE DARKNESS SLIDERS ===
    darknessSliders.forEach(slider => {
        const valueSpan = slider.nextElementSibling;

        slider.addEventListener('input', () => {
            valueSpan.textContent = parseInt(slider.value) + '%';
        });

        slider.addEventListener('change', () => {
            const key = slider.dataset.target;
            const val = parseInt(slider.value);
            chrome.storage.local.set({ [key]: val }, () => {
                refreshGeminiTabs();
            });
        });
    });

    // === GRADIENT PRESET SELECTION ===
    gradientPresets.querySelectorAll('.gradient-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const presetName = btn.dataset.gradient;
            setActiveGradientPreset(presetName);

            const preset = GRADIENT_PRESETS[presetName];
            if (preset) {
                gradientColorFrom.value = preset.from;
                gradientColorTo.value = preset.to;
            }

            updateGradientControlsState(presetName !== 'none');

            chrome.storage.local.set({
                gradient_preset: presetName,
                gradient_color_from: preset.from,
                gradient_color_to: preset.to
            }, () => {
                refreshGeminiTabs();
            });
        });
    });

    // === GRADIENT ANGLE SLIDER ===
    gradientAngle.addEventListener('input', () => {
        gradientAngleValue.textContent = parseInt(gradientAngle.value) + '°';
    });

    gradientAngle.addEventListener('change', () => {
        const val = parseInt(gradientAngle.value);
        chrome.storage.local.set({ gradient_angle: val }, () => {
            refreshGeminiTabs();
        });
    });

    // === GRADIENT INTENSITY SLIDER ===
    gradientIntensity.addEventListener('input', () => {
        gradientIntensityValue.textContent = parseInt(gradientIntensity.value) + '%';
    });

    gradientIntensity.addEventListener('change', () => {
        const val = parseInt(gradientIntensity.value);
        chrome.storage.local.set({ gradient_intensity: val }, () => {
            refreshGeminiTabs();
        });
    });

    // === APPLY CUSTOM GRADIENT BUTTON ===
    btnApplyCustomGradient.addEventListener('click', () => {
        const from = gradientColorFrom.value;
        const to = gradientColorTo.value;
        
        chrome.storage.local.set({
            gradient_preset: 'custom',
            gradient_color_from: from,
            gradient_color_to: to
        }, () => {
            setActiveGradientPreset('custom');
            refreshGeminiTabs();
        });
    });

    // === INIT ===
    loadState();
})();
