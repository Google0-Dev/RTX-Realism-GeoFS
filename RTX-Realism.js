// ==UserScript==
// @name         GeoFS 4K Realism & Physics Pack
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Enhanced shadows, turbulence, inertia, fog, ground effect, and camera realism for GeoFS 4.0
// @match        https://beta.geo-fs.com/*
// @match        https://www.geo-fs.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    "use strict";

    const CONFIG = {

        visualsInterval: 250,

        shadows: {
            enabled: true,
            size: 2048,
            softShadows: true,
            darkness: 0.35,
            maximumDistance: 35000
        },

        physics: {
            inertiaSmoothing: 0.95,
            baseTurbulence: 0.00012,
            groundEffectHeight: 80,
            groundEffectLift: 0.00025,
            maxShake: 0.0008
        },

        visuals: {

            transitionSpeed: 0.01,

            day: {
                contrast: 1.20,
                brightness: 1.03,
                saturate: 1.08
            },

            night: {
                contrast: 1.15,
                brightness: 0.92,
                saturate: 0.95
            }
        }
    };

     const State = {

        initialized: false,

        isNight: false,

        styleElement: null,

        lastFilter: "",

        shakeX: 0,
        shakeY: 0,

        targetShakeX: 0,
        targetShakeY: 0,

        lastFrame: performance.now(),

        lastVisualUpdate: 0,

        gust: 0,

        fx: {
            contrast: 1,
            brightness: 1,
            saturate: 1
        }
    };

       const safe = (fn, fallback = null) => {
        try {
            return fn();
        } catch {
            return fallback;
        }
    };

    const clamp = (v, min, max) =>
        Math.min(Math.max(v, min), max);

    const lerp = (a, b, t) =>
        a + (b - a) * t;


    function turbulenceNoise(t) {

        return (

            Math.sin(t * 0.41) * 0.60 +

            Math.sin(t * 1.17) * 0.30 +

            Math.sin(t * 2.73) * 0.15 +

            Math.sin(t * 5.91) * 0.08

        );
    }

        function applyVisualEnvironment(viewer) {

        if (!CONFIG.shadows.enabled) return;

        safe(() => {

            const scene = viewer.scene;

            const shadowMap = scene?.shadowMap;

            if (shadowMap) {

                shadowMap.enabled = true;

                shadowMap.size =
                    CONFIG.shadows.size;

                shadowMap.softShadows =
                    CONFIG.shadows.softShadows;

                shadowMap.darkness =
                    CONFIG.shadows.darkness;

                shadowMap.maximumDistance =
                    CONFIG.shadows.maximumDistance;
            }

            const fog = scene?.fog;

            if (fog) {

                fog.enabled = true;

                fog.density = 0.00012;

                fog.minimumBrightness = 0.30;
            }

        });
    }

    function checkLighting(viewer) {

        return safe(() => {

            const scene = viewer.scene;

            const camPos =
                scene.camera?.position;

            const sunPos =
                scene.sun?.position;

            const C3 =
                window.Cesium?.Cartesian3;

            if (!camPos || !sunPos || !C3)
                return State.isNight;

            const normal =
                C3.normalize(
                    camPos,
                    new C3()
                );

            const sunDir =
                C3.normalize(
                    sunPos,
                    new C3()
                );

            return (
                C3.dot(normal, sunDir) < -0.05
            );

        }, State.isNight);
    }

     function renderVisuals() {

        const target =
            State.isNight
                ? CONFIG.visuals.night
                : CONFIG.visuals.day;

        const spd =
            CONFIG.visuals.transitionSpeed;

        State.fx.contrast =
            lerp(
                State.fx.contrast,
                target.contrast,
                spd
            );

        State.fx.brightness =
            lerp(
                State.fx.brightness,
                target.brightness,
                spd
            );

        State.fx.saturate =
            lerp(
                State.fx.saturate,
                target.saturate,
                spd
            );

        const altitude =
            window.geofs?.aircraft?.instance
                ?.llaLocation?.[2] || 0;

        const altitudeExposure =
            clamp(
                altitude / 12000,
                0,
                1
            );

        const finalBrightness =
            State.fx.brightness +
            altitudeExposure * 0.08;

        const filterStr =

            `contrast(${State.fx.contrast.toFixed(3)}) ` +

            `brightness(${finalBrightness.toFixed(3)}) ` +

            `saturate(${State.fx.saturate.toFixed(3)})`;

        if (filterStr === State.lastFilter)
            return;

        State.lastFilter = filterStr;

        if (!State.styleElement) {

            State.styleElement =
                document.createElement("style");

            document.head.appendChild(
                State.styleElement
            );
        }

        State.styleElement.textContent = `

            canvas {

                filter: ${filterStr} !important;

                transition: none !important;

                transform: translateZ(0);

                backface-visibility: hidden;

            }

        `;
    }

      function updateFlightPhysics(
        viewer,
        deltaTime
    ) {

        const aircraft =
            window.geofs?.aircraft?.instance;

        const camera =
            viewer?.scene?.camera;

        if (!aircraft || !camera)
            return;

        safe(() => {

            const speed =
                aircraft.trueAirSpeed || 0;

            const altitude =
                aircraft.llaLocation?.[2] || 0;

            const grounded =
                aircraft.groundContact;

            const dt =
                Math.min(
                    deltaTime,
                    0.033
                );

            const airDensity =
                clamp(
                    1 - (altitude / 15000),
                    0.15,
                    1
                );

            const machStress =
                clamp(
                    (speed - 80) / 250,
                    0,
                    1.2
                );

            let turbulence =

                CONFIG.physics.baseTurbulence +

                machStress *
                airDensity *
                0.0005;

            if (grounded)
                turbulence *= 0.15;


            if (Math.random() < 0.003) {

                State.gust =
                    0.5 +
                    Math.random() * 1.5;
            }

            State.gust =
                lerp(
                    State.gust,
                    0,
                    dt * 0.4
                );

            turbulence *=
                (1 + State.gust);

            const t =
                performance.now() * 0.001;

            const noiseX =
                turbulenceNoise(t);

            const noiseY =
                turbulenceNoise(t + 17);

            const noiseZ =
                turbulenceNoise(t + 41);

            let groundEffect = 0;

            const agl =

                altitude -

                (window.geofs?.api
                    ?.groundElevation || 0);

            if (
                !grounded &&
                agl > 1 &&
                agl <
                    CONFIG.physics
                        .groundEffectHeight
            ) {

                const intensity =
                    1 -
                    (
                        agl /
                        CONFIG.physics
                            .groundEffectHeight
                    );

                groundEffect =

                    Math.pow(
                        intensity,
                        2
                    ) *

                    CONFIG.physics
                        .groundEffectLift *

                    (speed / 50);
            }

            const wingLoad =
                clamp(
                    speed / 180,
                    0,
                    1.5
                );

            const flex =

                Math.sin(t * 8) *

                wingLoad *

                0.00005;

            State.targetShakeX =
                noiseX * turbulence;

            State.targetShakeY =

                noiseY *
                turbulence +

                groundEffect +

                flex;

            const inertia =
                clamp(
                    0.88 +
                    speed *
                    0.00008,
                    0.88,
                    0.97
                );

            const smoothing =

                1 -

                Math.pow(
                    inertia,
                    dt * 60
                );

            State.shakeX =
                lerp(
                    State.shakeX,
                    State.targetShakeX,
                    smoothing
                );

            State.shakeY =
                lerp(
                    State.shakeY,
                    State.targetShakeY,
                    smoothing
                );

            State.shakeX =
                clamp(
                    State.shakeX,
                    -CONFIG.physics.maxShake,
                    CONFIG.physics.maxShake
                );

            State.shakeY =
                clamp(
                    State.shakeY,
                    -CONFIG.physics.maxShake,
                    CONFIG.physics.maxShake
                );

            camera.rotateRight(
                State.shakeX *
                dt *
                60
            );

            camera.rotateUp(
                State.shakeY *
                dt *
                60
            );

            safe(() => {

                if (
                    typeof camera.moveForward ===
                    "function"
                ) {

                    camera.moveForward(

                        noiseZ *

                        turbulence *

                        3
                    );
                }

            });

        });
    }

     function frameLoop(now) {

        const viewer =
            window.geofs?.api?.viewer;

        if (viewer) {

            const deltaTime =

                (now -
                State.lastFrame) / 1000;

            State.lastFrame = now;

            updateFlightPhysics(
                viewer,
                deltaTime
            );

            if (

                now -
                State.lastVisualUpdate >

                CONFIG.visualsInterval

            ) {

                State.lastVisualUpdate =
                    now;

                applyVisualEnvironment(
                    viewer
                );

                State.isNight =
                    checkLighting(
                        viewer
                    );

                renderVisuals();
            }
        }

        requestAnimationFrame(
            frameLoop
        );
    }

     function init() {

        if (State.initialized)
            return;

        const viewer =
            window.geofs?.api?.viewer;

        if (!viewer)
            return;

        State.initialized = true;

        Object.assign(
            State.fx,
            CONFIG.visuals.day
        );

        console.log(
            "%c[GeoFS 4K Realism Pack v1.0] Loaded",
            "color:#00ffcc;font-weight:bold;"
        );

        requestAnimationFrame(
            frameLoop
        );
    }

     const boot = setInterval(() => {

        if (
            window.geofs?.api?.viewer &&
            window.Cesium
        ) {

            clearInterval(boot);

            init();
        }

    }, 250);

})();
