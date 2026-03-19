// ==UserScript==
// @name         GeoFS RTX Aircraft
// @namespace    geofs.msfs.ultra.nextlevel
// @version      1.1
// @description  Dynamic reflections, specular highlights, heat haze, wet surfaces
// @match        https://www.geo-fs.com/*
// @grant        none
// ==/UserScript==

(function () {
    "use strict";

    let reflectionLayer, specularLayer, heatLayer;

    function createLayers() {
        if (!reflectionLayer) {
            reflectionLayer = document.createElement("div");
            Object.assign(reflectionLayer.style, {
                position: "fixed",
                inset: "0",
                pointerEvents: "none",
                zIndex: "999",
                mixBlendMode: "screen"
            });
            document.body.appendChild(reflectionLayer);
        }

        if (!specularLayer) {
            specularLayer = document.createElement("div");
            Object.assign(specularLayer.style, {
                position: "fixed",
                inset: "0",
                pointerEvents: "none",
                zIndex: "1000",
                mixBlendMode: "overlay"
            });
            document.body.appendChild(specularLayer);
        }

        if (!heatLayer) {
            heatLayer = document.createElement("div");
            Object.assign(heatLayer.style, {
                position: "fixed",
                inset: "0",
                pointerEvents: "none",
                zIndex: "1001",
                opacity: "0.15",
                mixBlendMode: "distort"
            });
            document.body.appendChild(heatLayer);
        }
    }

    function getSun() {
        const h = new Date().getHours();

        const x = (h / 24) * 100;
        const y = h < 12
            ? 20 + (h / 12) * 30
            : 50 - ((h - 12) / 12) * 30;

        let strength = 0.7;
        if (h >= 6 && h < 10) strength = 1.2;
        else if (h >= 17 && h < 20) strength = 1.3;

        return { x, y, strength };
    }

    function getCameraShift() {
        try {
            const hdg = window.geofs?.aircraft?.instance?.heading || 0;
            return (hdg % 360) / 360;
        } catch {
            return 0.5;
        }
    }

    function getAltitude() {
        return window.geofs?.aircraft?.instance?.llaLocation?.alt || 0;
    }

    function updateVisuals() {
        const sun = getSun();
        const cam = getCameraShift();
        const alt = getAltitude();

        const shiftX = sun.x + (cam - 0.5) * 30;

        /* === DYNAMIC REFLECTION === */
        reflectionLayer.style.background = `
            radial-gradient(
                circle at ${shiftX}% ${sun.y}%,
                rgba(255,255,255,${0.12 * sun.strength}),
                rgba(255,255,255,${0.05 * sun.strength}) 25%,
                transparent 60%
            )
        `;

        /* === SPECULAR (METAL GLINT) === */
        specularLayer.style.background = `
            radial-gradient(
                circle at ${shiftX}% ${sun.y}%,
                rgba(255,255,255,${0.25 * sun.strength}),
                rgba(255,255,255,0.08) 10%,
                transparent 30%
            )
        `;

        /* === HEAT HAZE (LOW ALT / ENGINES) === */
        if (alt < 200) {
            heatLayer.style.background = `
                repeating-linear-gradient(
                    0deg,
                    rgba(255,255,255,0.02) 0px,
                    rgba(0,0,0,0.02) 2px,
                    transparent 4px
                )
            `;
        } else {
            heatLayer.style.background = "none";
        }

        /* === WET RUNWAY EFFECT === */
        if (alt < 50) {
            reflectionLayer.style.background += `,
            radial-gradient(
                circle at 50% 85%,
                rgba(255,255,255,0.08),
                transparent 70%
            )`;
        }
    }

    function applyShader() {
        const style = document.createElement("style");

        style.innerHTML = `
        canvas, video {
            filter:
                brightness(1.05)
                contrast(1.15)
                saturate(1.1);
        }

        /* === METALLIC FINISH === */
        canvas {
            filter:
                brightness(1.05)
                contrast(1.15)
                saturate(1.1)
                drop-shadow(0 0 20px rgba(255,255,255,0.10))
                drop-shadow(0 0 40px rgba(255,255,255,0.06));
        }

        /* === DEPTH & SOFT LIGHT === */
        canvas {
            box-shadow:
                inset 0 0 140px rgba(255,255,255,0.05),
                inset 0 0 260px rgba(180,200,255,0.06);
        }

        /* === ULTRA SMOOTH (NO ARTIFACTS) === */
        canvas {
            transform: translateZ(0);
            backface-visibility: hidden;
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
        applyShader();

        setInterval(updateVisuals, 60);

        console.log("🔥 MSFS ULTRA++ ACTIVE");
    }

    init();
})();
