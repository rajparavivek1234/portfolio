/*
 * scene.js — background three.js scene.
 *
 * A wireframe "orchestrator" core sits in the middle; one node per payment
 * processor sits on a shell around it. Request packets fly out to a node and a
 * response packet comes back coloured by outcome (approved / pending / declined).
 * Every response that lands fires a `tx` CustomEvent on window, which app.js
 * prints into the hero's transaction log.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("scene");
  var logEl = document.getElementById("tx-log");
  if (!canvas || typeof THREE === "undefined") { document.documentElement.classList.add("no-webgl"); return; }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var processors = [];
  try { processors = JSON.parse(logEl.getAttribute("data-processors")); } catch (err) { processors = []; }
  if (!processors.length) processors = ["Adyen", "Stripe", "PayPal", "dLocal", "Nuvei"];

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    document.documentElement.classList.add("no-webgl");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.028);
  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 14);

  var COLORS = { req: new THREE.Color(0xc7d2fe), ok: new THREE.Color(0x5eead4), pend: new THREE.Color(0xfbbf24), bad: new THREE.Color(0xfb7185) };

  // Soft round glow texture generated on a canvas, shared by every sprite.
  function glowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,.75)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    var t = new THREE.CanvasTexture(c);
    return t;
  }
  var GLOW = glowTexture();

  function sprite(color, size, opacity) {
    var m = new THREE.SpriteMaterial({ map: GLOW, color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending });
    var s = new THREE.Sprite(m);
    s.scale.set(size, size, 1);
    return s;
  }

  var world = new THREE.Group();
  scene.add(world);

  // ---- core ----
  var core = new THREE.Group();
  var coreEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.15, 1)),
    new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.85 })
  );
  var coreInner = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62, 0)),
    new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.9 })
  );
  var coreGlow = sprite(0x5eead4, 5.5, 0.35);
  core.add(coreEdges, coreInner, coreGlow);
  world.add(core);

  // ---- orbit rings ----
  function ring(radius, tiltX, tiltY, color, opacity) {
    var pts = [];
    for (var i = 0; i <= 128; i++) {
      var a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
    }
    var line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: opacity }));
    line.rotation.set(tiltX, tiltY, 0);
    return line;
  }
  var rings = [ring(2.3, 1.2, 0.3, 0x818cf8, 0.25), ring(3.1, 0.4, 1.1, 0x5eead4, 0.14), ring(5.6, 1.45, 0.0, 0x8b97ad, 0.08)];
  rings.forEach(function (r) { world.add(r); });

  // ---- processor nodes on a Fibonacci sphere ----
  var nodes = [];
  var linePositions = [];
  var n = processors.length;
  var golden = Math.PI * (3 - Math.sqrt(5));
  for (var i = 0; i < n; i++) {
    var y = 1 - (i / (n - 1)) * 2;
    var r = Math.sqrt(1 - y * y);
    var theta = golden * i;
    var radius = 4.6 + Math.random() * 1.6;
    var pos = new THREE.Vector3(Math.cos(theta) * r * radius, y * radius * 0.82, Math.sin(theta) * r * radius);
    var dot = sprite(0xc7d2fe, 0.42, 0.85);
    dot.position.copy(pos);
    world.add(dot);
    nodes.push({ name: processors[i], pos: pos, sprite: dot, flash: 0, color: new THREE.Color(0xc7d2fe) });
    linePositions.push(0, 0, 0, pos.x, pos.y, pos.z);
  }
  var spokeGeo = new THREE.BufferGeometry();
  spokeGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
  var spokes = new THREE.LineSegments(spokeGeo, new THREE.LineBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0.09 }));
  world.add(spokes);

  // ---- star dust ----
  var starCount = window.innerWidth < 720 ? 700 : 1600;
  var starPos = new Float32Array(starCount * 3);
  for (var s = 0; s < starCount; s++) {
    var d = 22 + Math.random() * 60;
    var u = Math.random() * 2 - 1, phi = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    starPos[s * 3] = q * Math.cos(phi) * d;
    starPos[s * 3 + 1] = u * d;
    starPos[s * 3 + 2] = q * Math.sin(phi) * d;
  }
  var starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb0d6, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false }));
  scene.add(stars);

  // ---- packets ----
  var packets = [];
  var pool = [];
  function getSprite() {
    var sp = pool.pop() || sprite(0xffffff, 0.3, 1);
    sp.visible = true;
    world.add(sp);
    return sp;
  }
  function release(p) { p.sprite.visible = false; world.remove(p.sprite); pool.push(p.sprite); }

  function outcome() {
    var x = Math.random();
    if (x < 0.82) return "ok";
    if (x < 0.93) return "pend";
    return "bad";
  }
  var METHODS = ["card", "card", "card", "3ds", "wallet", "pix", "upi", "apm", "refund", "capture"];

  function spawn() {
    var node = nodes[(Math.random() * nodes.length) | 0];
    var mid = node.pos.clone().multiplyScalar(0.5);
    mid.add(new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6));
    var sp = getSprite();
    sp.material.color.copy(COLORS.req);
    sp.scale.set(0.26, 0.26, 1);
    packets.push({ node: node, mid: mid, t: 0, dur: 0.75 + Math.random() * 0.9, leg: "out", status: outcome(), method: METHODS[(Math.random() * METHODS.length) | 0], sprite: sp, born: performance.now() });
  }

  var tmp = new THREE.Vector3();
  function bezier(a, b, c, t, out) {
    var it = 1 - t;
    out.set(0, 0, 0)
      .addScaledVector(a, it * it)
      .addScaledVector(b, 2 * it * t)
      .addScaledVector(c, t * t);
    return out;
  }
  var ORIGIN = new THREE.Vector3();

  function updatePackets(dt) {
    for (var i = packets.length - 1; i >= 0; i--) {
      var p = packets[i];
      p.t += dt / p.dur;
      if (p.t >= 1) {
        if (p.leg === "out") {
          p.leg = "back";
          p.t = 0;
          p.dur = p.status === "pend" ? p.dur * 1.6 : p.dur;
          p.node.flash = 1;
          p.node.color.copy(COLORS[p.status]);
          p.sprite.material.color.copy(COLORS[p.status]);
          p.sprite.scale.set(0.34, 0.34, 1);
          continue;
        }
        window.dispatchEvent(new CustomEvent("tx", { detail: { provider: p.node.name, status: p.status, method: p.method, ms: Math.round((performance.now() - p.born) / 10) } }));
        core.userData.kick = 1;
        release(p);
        packets.splice(i, 1);
        continue;
      }
      if (p.leg === "out") bezier(ORIGIN, p.mid, p.node.pos, p.t, tmp);
      else bezier(p.node.pos, p.mid, ORIGIN, p.t, tmp);
      p.sprite.position.copy(tmp);
    }
  }

  // ---- interaction ----
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener("pointermove", function (ev) {
    mouse.tx = (ev.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (ev.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  var scrollP = 0;
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    scrollP = max > 0 ? window.scrollY / max : 0;
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // On wide screens the core sits behind the right half (next to the terminal).
    world.userData.baseX = w > 980 ? 3.4 : 0;
    world.userData.baseY = w > 980 ? 0 : -3.6;
  }
  window.addEventListener("resize", resize);
  resize();
  onScroll();

  // ---- loop ----
  var clock = new THREE.Clock();
  var spawnAcc = 0;
  var SPAWN_EVERY = 0.16;
  var MAX_PACKETS = 70;

  function frame() {
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    spawnAcc += dt;
    while (spawnAcc > SPAWN_EVERY) {
      spawnAcc -= SPAWN_EVERY;
      if (packets.length < MAX_PACKETS) spawn();
    }
    updatePackets(dt);

    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      if (nd.flash > 0) {
        nd.flash = Math.max(0, nd.flash - dt * 1.8);
        var sc = 0.42 + nd.flash * 0.7;
        nd.sprite.scale.set(sc, sc, 1);
        nd.sprite.material.color.copy(COLORS.req).lerp(nd.color, nd.flash);
      }
    }

    var kick = core.userData.kick || 0;
    core.userData.kick = Math.max(0, kick - dt * 3);
    coreEdges.rotation.x += dt * 0.25;
    coreEdges.rotation.y += dt * 0.35;
    coreInner.rotation.x -= dt * 0.5;
    coreInner.rotation.z += dt * 0.4;
    var cs = 1 + kick * 0.06;
    core.scale.set(cs, cs, cs);
    coreGlow.material.opacity = 0.3 + kick * 0.15 + Math.sin(t * 2) * 0.04;

    rings[0].rotation.z += dt * 0.12;
    rings[1].rotation.z -= dt * 0.08;
    rings[2].rotation.z += dt * 0.03;

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;

    world.rotation.y = t * 0.06 + scrollP * Math.PI * 1.4 + mouse.x * 0.25;
    world.rotation.x = 0.18 + mouse.y * 0.15 + Math.sin(scrollP * Math.PI) * 0.35;
    var bx = world.userData.baseX * (1 - Math.min(1, scrollP * 6));
    world.position.x += (bx - world.position.x) * 0.05;
    world.position.y += (world.userData.baseY - world.position.y) * 0.05;
    camera.position.z = 14 + Math.sin(scrollP * Math.PI) * 4;
    stars.rotation.y = t * 0.008;

    renderer.render(scene, camera);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  if (reduceMotion) {
    // One still frame; app.js fills the log with a static sample.
    world.rotation.set(0.18, 0.6, 0);
    world.position.set(world.userData.baseX, world.userData.baseY, 0);
    renderer.render(scene, camera);
    window.addEventListener("resize", function () { renderer.render(scene, camera); });
  } else {
    requestAnimationFrame(frame);
  }
  window.__sceneReady = true;
})();
