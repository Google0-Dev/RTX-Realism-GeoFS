// ==UserScript==
// @name         GeoFS SSR Light
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Performance-optimized Screen Space Reflections for GeoFS
// @author       Gemini
// @match        https://www.geo-fs.com/geofs.php*
// @match        https://*.geo-fs.com/geofs.php*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const waitForGeoFS = setInterval(() => {
        if (window.geofs && window.Cesium && window.geofs.api?.viewer) {
            clearInterval(waitForGeoFS);
            initSSRLight();
        }
    }, 1000);

    function initSSRLight() {
        geofs["rrt.glsl"] = `
        uniform sampler2D depthTexture;
        uniform sampler2D colorTexture;
        uniform bool isEnabled;
        varying vec2 v_textureCoordinates;

        // Fast eye-space position reconstruction
        vec3 getPosEC(vec2 uv, float depth) {
            vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
            vec4 posEC = czm_inverseProjection * ndc;
            return posEC.xyz / posEC.w;
        }

        void main(void) {
            vec4 baseColor = texture2D(colorTexture, v_textureCoordinates);
            if (!isEnabled) {
                gl_FragColor = baseColor;
                return;
            }

            float depth = czm_readDepth(depthTexture, v_textureCoordinates);
            if (depth > 0.999) { gl_FragColor = baseColor; return; }

            vec3 posEC = getPosEC(v_textureCoordinates, depth);
            // Lightweight normal reconstruction using screen derivatives
            vec3 normal = normalize(cross(dFdx(posEC), dFdy(posEC)));
            vec3 viewDir = normalize(posEC);
            vec3 reflectDir = reflect(viewDir, normal);

            // Simple raycast (Low iteration count for performance)
            vec3 currentPos = posEC;
            vec4 reflectColor = vec4(0.0);
            float stepSize = 0.8; 

            for (int i = 0; i < 8; i++) { // Only 8 steps vs original 100+
                currentPos += reflectDir * stepSize;
                vec4 proj = czm_projection * vec4(currentPos, 1.0);
                vec2 uv = (proj.xy / proj.w) * 0.5 + 0.5;

                if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;

                float sampleDepth = czm_readDepth(depthTexture, uv);
                vec3 samplePos = getPosEC(uv, sampleDepth);

                if (currentPos.z < samplePos.z && length(currentPos - samplePos) < 0.5) {
                    reflectColor = texture2D(colorTexture, uv);
                    break;
                }
            }

            gl_FragColor = mix(baseColor, reflectColor, 0.3 * reflectColor.a);
        }`;

        geofs.ssr = { isEnabled: false };

        // Simple Toggle UI
        let container = document.querySelector(".geofs-stopMousePropagation");
        if (container) {
            let btn = document.createElement("div");
            btn.innerHTML = `<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top:5px; width:100%;">Toggle Light SSR</button>`;
            btn.onclick = () => {
                geofs.ssr.isEnabled = !geofs.ssr.isEnabled;
                btn.firstChild.innerText = geofs.ssr.isEnabled ? "SSR: ON" : "SSR: OFF";
            };
            container.appendChild(btn);
        }

        geofs.fx.rrt = {
            create: function() {
                this.shader = new Cesium.PostProcessStage({
                    fragmentShader: geofs["rrt.glsl"],
                    uniforms: { isEnabled: () => geofs.ssr.isEnabled }
                });
                geofs.api.viewer.scene.postProcessStages.add(this.shader);
            }
        };
        geofs.fx.rrt.create();
    }
})();
