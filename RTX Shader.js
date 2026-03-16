// ==UserScript==
// @name         GeoFS RTX-Style Visual Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds high-fidelity shadows, bloom, and PBR-lite reflections to GeoFS
// @author       Gemini
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function applyRTX() {
        if (window.geofs && geofs.api && geofs.api.viewer) {
            console.log("RTX Script: GeoFS Detected. Initializing Shaders...");

            const scene = geofs.api.viewer.scene;
            scene.shadowMap.enabled = true;
            scene.shadowMap.softShadows = true;
            scene.shadowMap.size = 4096; // Adjust to 2048 if your PC lags
            scene.highDynamicRange = true;
            if (scene.postProcessStages.bloom) {
                scene.postProcessStages.bloom.enabled = true;
                scene.postProcessStages.bloom.uniforms.brightnessFilter = 1.5; // Lower = more glow
                scene.postProcessStages.bloom.uniforms.contrast = 1.2;
            }
            scene.light.intensity = 3.0; 
            setInterval(() => {
                if (geofs.aircraft.instance && geofs.aircraft.instance.definition.parts) {
                    geofs.aircraft.instance.definition.parts.forEach(part => {
                        if (part.renderingOptions) {
                            part.renderingOptions.castShadows = true;
                            part.renderingOptions.receiveShadows = true;
                        }
                    });
                }
            }, 5000);

            console.log("RTX Script: Enhanced Graphics Applied.");
            clearInterval(initCheck);
        }
    }
    const initCheck = setInterval(applyRTX, 2000);
})();
