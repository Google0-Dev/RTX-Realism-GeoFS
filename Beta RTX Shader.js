// ==UserScript==
// @name         GeoFS RTX-Style Visual Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Fixes purple floor glitch and stabilizes high-fidelity lighting in GeoFS
// @author       Google0
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function applyRTX() {
        if (window.geofs && geofs.api && geofs.api.viewer) {
            console.log("RTX Script: Fixing Terrain and Initializing Shaders...");

            const scene = geofs.api.viewer.scene;

            // --- SHADOW FIXES ---
            scene.shadowMap.enabled = true;
            scene.shadowMap.softShadows = true;
            scene.shadowMap.size = 2048; 
            scene.shadowMap.darkness = 0.6; // Prevents pitch-black "ink" shadows

            // --- LIGHTING FIX (The "Purple Floor" Fix) ---
            // Dropping intensity from 3.0 to 1.2 prevents the HDR buffer from overflowing into magenta.
            scene.highDynamicRange = true;
            scene.light.intensity = 0.5; 

            // --- BLOOM TUNING ---
            if (scene.postProcessStages.bloom) {
                scene.postProcessStages.bloom.enabled = true;
                // Higher brightnessFilter means only the sun and white paint glow, not the grass.
                scene.postProcessStages.bloom.uniforms.brightnessFilter = 0.7; 
                scene.postProcessStages.bloom.uniforms.contrast = 1.1;
            }

            // --- AIRCRAFT SPECIFIC RENDERING ---
            const shadowInterval = setInterval(() => {
                if (geofs.aircraft && geofs.aircraft.instance && geofs.aircraft.instance.definition.parts) {
                    geofs.aircraft.instance.definition.parts.forEach(part => {
                        if (part.renderingOptions) {
                            part.renderingOptions.castShadows = true;
                            part.renderingOptions.receiveShadows = true;
                        }
                    });
                }
            }, 5000);

            console.log("RTX Script: Visuals Stabilized.");
            clearInterval(initCheck);
        }
    }

    const initCheck = setInterval(applyRTX, 2000);
})();
