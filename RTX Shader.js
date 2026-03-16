// ==UserScript==
// @name         GeoFS Reflections (Lightweight)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Adds shiny reflections using MatCap/Env-Mapping
// @author       Google0
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
            initFakeReflections();
        }
    }, 1000);

    function initFakeReflections() {
        geofs["rrt.glsl"] = `
        uniform sampler2D colorTexture;
        uniform sampler2D depthTexture;
        uniform bool isEnabled;
        varying vec2 v_textureCoordinates;

        void main(void) {
            vec4 baseColor = texture2D(colorTexture, v_textureCoordinates);
            if (!isEnabled) {
                gl_FragColor = baseColor;
                return;
            }

            float depth = czm_readDepth(depthTexture, v_textureCoordinates);
            if (depth > 0.99) { 
                gl_FragColor = baseColor; 
                return; 
            }

            // Reconstruct cheap normals from screen derivatives
            // No loops, no raymarching - very fast for old PCs
            vec3 posEC = (czm_inverseProjection * vec4(v_textureCoordinates * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0)).xyz;
            vec3 normal = normalize(cross(dFdx(posEC), dFdy(posEC)));
            vec3 viewDir = normalize(posEC);
            
            // Calculate reflection vector
            vec3 reflectDir = reflect(viewDir, normal);
            
            // Create a fake 'Sky/Ground' gradient based on the reflection vector's Y component
            // This mimics the look of a horizon reflection
            float horizon = smoothstep(-0.2, 0.2, reflectDir.y);
            vec3 fakeEnv = mix(vec3(0.4, 0.3, 0.2), vec3(0.7, 0.8, 1.0), horizon);
            
            // Add a 'sun' highlight based on reflection
            float specular = pow(max(dot(reflectDir, vec3(0.0, 1.0, 0.5)), 0.0), 32.0);
            fakeEnv += specular * 0.5;

            // Blend the fake reflection with the original aircraft color
            // We use a low mix value so it looks like polished paint/metal
            gl_FragColor = vec4(mix(baseColor.rgb, fakeEnv, 0.15), baseColor.a);
        }`;

        geofs.ssr = { isEnabled: true };
        let container = document.querySelector(".geofs-stopMousePropagation");
        if (container) {
            let btn = document.createElement("div");
            btn.innerHTML = `<button class="mdl-button mdl-js-button mdl-button--raised" style="margin-top:5px; width:100%; background: #2196F3; color: white;">Toggle Shine</button>`;
            btn.onclick = () => {
                geofs.ssr.isEnabled = !geofs.ssr.isEnabled;
                btn.firstChild.style.background = geofs.ssr.isEnabled ? "#2196F3" : "#555";
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
