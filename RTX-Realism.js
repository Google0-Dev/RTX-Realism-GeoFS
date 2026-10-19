// ==UserScript==
// @name         GeoFS 4K Realism & Physics Pack
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Zero-drift camera physics, optimized lag-free visuals, and stable turbulence.
// @author       Google0 (Refactored)
// @match        https://beta.geo-fs.com/*
// @match        https://www.geo-fs.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geo-fs.com
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(() => {
    "use strict";

    const CONFIG = {
        visualsInterval: 500,

        shadows: {
            enabled: true,
            size: 4096, // 2048 is highly optimized; 4096 causes VRAM lag on many GPUs
            softShadows: true,
            darkness: 0.60
        },

        physics: {
            baseTurbulence: 0.00005,
            groundEffectHeight: 15,
            groundEffectLift: 0.0003,
            maxShake: 0.002 
        },

        visuals: {
            day: { contrast: 1.12, brightness: 1.02, saturate: 1.10 },
            night: { contrast: 1.20, brightness: 0.90, saturate: 0.80 }
        }
    };

    const State = {
        initialized: false,
        isNight: false,
        lastFilter: "",
        lastVisualUpdate: 0,
        lastTime: performance.now(),
        gust: 0,
        currentVisuals: { contrast: 1, brightness: 1, saturate: 1 },

        offsetX: 0,
        offsetY: 0
    };

    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const lerp = (a, b, t) => a + (b - a) * t;
    const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

    function turbulenceNoise(t) {
        return Math.sin(t * 0.41) * 0.5 + Math.sin(t * 1.17) * 0.25 + Math.sin(t * 2.73) * 0.15;
    }

    function initEnvironment(viewer) {
        safe(() => {
            const scene = viewer.scene;
            if (CONFIG.shadows.enabled && scene.shadowMap) {
                scene.shadowMap.enabled = true;
                scene.shadowMap.size = CONFIG.shadows.size;
                scene.shadowMap.softShadows = CONFIG.shadows.softShadows;
                scene.shadowMap.darkness = CONFIG.shadows.darkness;
            }
            if (scene.fog) {
                scene.fog.enabled = true;
                scene.fog.density = 0.0001;
            }
        });
    }

    function renderVisuals(viewer) {
        const target = State.isNight ? CONFIG.visuals.night : CONFIG.visuals.day;

        State.currentVisuals.contrast = lerp(State.currentVisuals.contrast, target.contrast, 0.1);
        State.currentVisuals.brightness = lerp(State.currentVisuals.brightness, target.brightness, 0.1);
        State.currentVisuals.saturate = lerp(State.currentVisuals.saturate, target.saturate, 0.1);

        const filterStr = `contrast(${State.currentVisuals.contrast.toFixed(2)}) brightness(${State.currentVisuals.brightness.toFixed(2)}) saturate(${State.currentVisuals.saturate.toFixed(2)})`;

        if (filterStr !== State.lastFilter) {
            State.lastFilter = filterStr;
            const canvas = viewer.canvas;
            if (canvas) {
                canvas.style.filter = filterStr;
                canvas.style.transform = "translateZ(0)";
            }
        }
    }

    function updatePhysics(viewer, deltaTime) {
        const aircraft = window.geofs?.aircraft?.instance;
        const camera = viewer?.scene?.camera;

        if (!aircraft || !camera) return;

        safe(() => {
            const speed = aircraft.trueAirSpeed || 0;
            const altitude = aircraft.llaLocation?.[2] || 0;
            const grounded = aircraft.groundContact;

            const airDensity = Math.max(0.1, Math.exp(-altitude / 8500));
            const dynamicPressure = 0.5 * airDensity * (speed * speed);

            let turbulence = CONFIG.physics.baseTurbulence + (dynamicPressure * 0.0000003);
            if (grounded) turbulence *= 0.1; 

            if (Math.random() < 0.005) State.gust = 0.5 + Math.random();
            State.gust = lerp(State.gust, 0, deltaTime * 2.0);
            turbulence *= (1 + State.gust);

            const t = performance.now() * 0.001;
            const noiseX = turbulenceNoise(t);
            const noiseY = turbulenceNoise(t + 17.5);

            let groundEffect = 0;
            const agl = altitude - (window.geofs?.api?.groundElevation || 0);
            if (!grounded && agl > 0.5 && agl < CONFIG.physics.groundEffectHeight) {
                const intensity = Math.pow(1 - (agl / CONFIG.physics.groundEffectHeight), 2);
                groundEffect = intensity * CONFIG.physics.groundEffectLift * (speed / 50);
            }

            let targetX = noiseX * turbulence;
            let targetY = (noiseY * turbulence) + groundEffect;

            targetX = clamp(targetX, -CONFIG.physics.maxShake, CONFIG.physics.maxShake);
            targetY = clamp(targetY, -CONFIG.physics.maxShake, CONFIG.physics.maxShake);

            camera.lookRight(-State.offsetX);
            camera.lookUp(-State.offsetY);

            State.offsetX = lerp(State.offsetX, targetX, deltaTime * 15);
            State.offsetY = lerp(State.offsetY, targetY, deltaTime * 15);

            camera.lookRight(State.offsetX);
            camera.lookUp(State.offsetY);
        });
    }

    function init() {
        if (State.initialized) return;
        const viewer = window.geofs?.api?.viewer;
        if (!viewer || !viewer.scene) return;

        State.initialized = true;
        Object.assign(State.currentVisuals, CONFIG.visuals.day);
        initEnvironment(viewer);

        viewer.scene.preRender.addEventListener(() => {
            const now = performance.now();
            let deltaTime = (now - State.lastTime) / 1000;
            State.lastTime = now;

            if (deltaTime > 0.1) deltaTime = 0.016;

            updatePhysics(viewer, deltaTime);

            if (now - State.lastVisualUpdate > CONFIG.visualsInterval) {
                State.lastVisualUpdate = now;

                safe(() => {
                    const camPos = viewer.scene.camera?.position;
                    const sunPos = viewer.scene.sun?.position;
                    const C3 = window.Cesium?.Cartesian3;
                    if (camPos && sunPos && C3) {
                        const normal = C3.normalize(camPos, new C3());
                        const sunDir = C3.normalize(sunPos, new C3());
                        State.isNight = (C3.dot(normal, sunDir) < -0.05);
                    }
                });

                renderVisuals(viewer);
            }
        });

        console.log("%c[GeoFS Pro Realism v3.0] Engine Stabilized and Injected", "color:#00ffcc; font-weight:bold;");
    }

    const boot = setInterval(() => {
        if (window.geofs?.api?.viewer?.scene && window.Cesium && window.geofs.aircraft?.instance) {
            clearInterval(boot);
            init();
        }
    }, 500);
})();
