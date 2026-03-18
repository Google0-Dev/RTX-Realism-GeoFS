// ==UserScript==
// @name         GeoFS RTX styled Aircraft
// @namespace    geofs.msfs.ultra.final
// @version      1.0
// @description  Full MSFS 2024 ultra realism: reflections, sun glare, haze, night glow, runway shine
// @match        https://www.geo-fs.com/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    let overlay, glare;

    function createLayers() {
        if (!overlay) {
            overlay = document.createElement("div");
            Object.assign(overlay.style, {
                position: "fixed",
                inset: "0",
                pointerEvents: "none",
                zIndex: "999",
                mixBlendMode: "screen"
            });
            document.body.appendChild(overlay);
        }

        if (!glare) {
            glare = document.createElement("div");
            Object.assign(glare.style, {
                position: "fixed",
                inset: "0",
                pointerEvents: "none",
                zIndex: "1000",
                mixBlendMode: "add",
                transition: "background 0.2s linear"
            });
            document.body.appendChild(glare);
        }
    }

    function getSunData() {
        const hour = new Date().getHours();

        const x = (hour / 24) * 100;
        const y = hour < 12
            ? 25 + (hour / 12) * 25
            : 50 - ((hour - 12) / 12) * 25;

        let intensity;
        if (hour >= 6 && hour < 10) intensity = 0.9;
        else if (hour >= 10 && hour < 17) intensity = 0.6;
        else if (hour >= 17 && hour < 20) intensity = 1.2;
        else intensity = 0.3;

        return { x, y, intensity };
    }

    function getAltitude() {
        try {
            return window.geofs?.aircraft?.instance?.llaLocation?.alt || 0;
        } catch {
            return 0;
        }
    }

    function updateVisuals() {
        const sun = getSunData();
        const alt = getAltitude();

        const lowAlt = alt < 80;

        /* === REFLECTION LAYER === */
        overlay.style.background = `
            radial-gradient(
                circle at ${sun.x}% ${sun.y}%,
                rgba(255,255,255,${0.08 * sun.intensity}),
                rgba(255,255,255,${0.03 * sun.intensity}) 20%,
                transparent 40%
            )
        `;

        /* === SUN GLARE (LOOKING AT SUN EFFECT) === */
        glare.style.background = `
            radial-gradient(
                circle at ${sun.x}% ${sun.y}%,
                rgba(255,240,200,${0.25 * sun.intensity}),
                rgba(255,200,120,${0.15 * sun.intensity}) 15%,
                transparent 35%
            )
        `;

        /* === WET RUNWAY BOOST === */
        if (lowAlt) {
            overlay.style.background += `,
            radial-gradient(
                circle at 50% 80%,
                rgba(255,255,255,0.06),
                transparent 60%
            )`;
        }
    }

    function applyCoreShader() {
        const style = document.createElement("style");

        style.innerHTML = `
        canvas, video {
            filter:
                brightness(1.06)
                contrast(1.18)
                saturate(1.15)
                hue-rotate(-3deg)
                sepia(0.05);
        }

        /* === ATMOSPHERIC HAZE === */
        canvas {
            box-shadow:
                inset 0 0 150px rgba(180,200,255,0.10),
                inset 0 0 250px rgba(255,200,150,0.08);
        }

        /* === SHARPEN (MSFS CRISP LOOK) === */
        canvas {
            image-rendering: auto;
        }

        /* === LIGHT BLOOM === */
        canvas {
            filter:
                brightness(1.06)
                contrast(1.18)
                saturate(1.15)
                drop-shadow(0 0 15px rgba(255,220,180,0.15))
                drop-shadow(0 0 35px rgba(255,200,150,0.08));
        }

        /* === NIGHT LIGHT BOOST === */
        body::after {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background: radial-gradient(
                circle,
                rgba(255,180,120,0.04),
                transparent 70%
            );
            mix-blend-mode: screen;
        }

        /* === COCKPIT SAFE === */
        .geofs-cockpit, .cockpit, .hud {
            filter: none !important;
        }
        `;

        document.head.appendChild(style);
    }

    function init() {
        const canvas = document.querySelector("canvas");
        if (!canvas) {
            setTimeout(init, 1000);
            return;
        }

        createLayers();
        applyCoreShader();

        setInterval(updateVisuals, 80);

        console.log("🚀 MSFS 2024 ULTRA VISUAL SYSTEM ACTIVE");
    }

    init();
})();
