/*
 * app.js: page behaviour. Rotating headline, the agent-run replay (log lines
 * light up the matching pipeline stage), stat counters, scroll reveal and the
 * active nav link. Everything degrades to static content without JS.
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function parse(el, attr) { try { return JSON.parse(el.getAttribute(attr)); } catch (err) { return []; } }

  // ---- rotating headline ----
  var rot = document.getElementById("rot");
  if (rot && !reduceMotion) {
    var words = parse(rot, "data-words");
    var wi = 0, text = words[0] || "", typing = false;
    var loop = function () {
      if (!typing) {
        text = text.slice(0, -1);
        rot.textContent = text;
        if (!text) { typing = true; wi = (wi + 1) % words.length; }
        return setTimeout(loop, 28);
      }
      var w = words[wi];
      text = w.slice(0, text.length + 1);
      rot.textContent = text;
      if (text === w) { typing = false; return setTimeout(loop, 2400); }
      setTimeout(loop, 55);
    };
    if (words.length > 1) setTimeout(loop, 2400);
  }

  // ---- agent run replay ----
  var log = document.getElementById("agent-log");
  var state = document.getElementById("run-state");
  var demo = document.getElementById("agent-demo");
  var replay = document.getElementById("replay");
  var steps = log ? parse(log, "data-run") : [];
  var stages = Array.prototype.slice.call(document.querySelectorAll(".stage"));
  var order = stages.map(function (s) { return s.getAttribute("data-stage"); });
  var timer = null, running = false;

  function lineClass(step) {
    if (step.stage === "gate") return "l-gate";
    if (/FAIL/.test(step.text)) return "l-fail";
    if (/PASS|released/.test(step.text)) return "l-ok";
    return "";
  }
  function addLine(step) {
    var li = document.createElement("li");
    li.className = lineClass(step);
    var tag = document.createElement("span"); tag.className = "tag"; tag.textContent = "[" + step.stage + "]";
    var msg = document.createElement("span"); msg.className = "msg"; msg.textContent = step.text;
    li.appendChild(tag); li.appendChild(msg);
    log.appendChild(li);
  }
  function mark(stageId) {
    var idx = order.indexOf(stageId);
    stages.forEach(function (s, i) {
      s.classList.toggle("done", i < idx);
      s.classList.toggle("active", i === idx);
    });
  }
  function finish() {
    stages.forEach(function (s) { s.classList.add("done"); s.classList.remove("active"); });
    state.textContent = "done ✓";
    running = false;
  }
  function run() {
    if (!log || !steps.length) return;
    clearTimeout(timer);
    log.innerHTML = "";
    running = true;
    if (reduceMotion) { steps.forEach(addLine); finish(); return; }
    var i = 0;
    state.textContent = "running…";
    (function next() {
      if (i >= steps.length) { timer = setTimeout(finish, 700); return; }
      var step = steps[i++];
      mark(step.stage);
      addLine(step);
      if (step.stage === "gate") state.textContent = "waiting for human…";
      else state.textContent = "running…";
      timer = setTimeout(next, step.stage === "gate" ? 2100 : 1050);
    })();
  }
  if (replay) replay.addEventListener("click", run);
  if (demo && "IntersectionObserver" in window) {
    var started = false;
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && !started) { started = true; run(); }
    }, { threshold: 0.35 }).observe(demo);
  } else { run(); }

  // ---- Monte Carlo ETA simulation (same method as the Feature ETA Agent's engine) ----
  // effort ~ PERT-Beta(O, M, P) per task; design -> (backend || frontend) -> QA & release;
  // 2,000 runs -> P50 / P80 / P95, converted to working days from today.
  var simChart = document.getElementById("sim-chart");
  if (simChart) {
    var TASKS = { design: [2, 3, 6], backend: [5, 8, 15], frontend: [3, 5, 10], release: [2, 3, 7] };
    var SIMS = 2000, BINS = 32, NS = "http://www.w3.org/2000/svg";
    var gauss = function () { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    var gamma = function (k) { // Marsaglia–Tsang, k >= 1
      var d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) {
        var x = gauss(), v = Math.pow(1 + c * x, 3);
        if (v <= 0) continue;
        var u = Math.random();
        if (Math.log(u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
      }
    };
    var pert = function (t) {
      var o = t[0], m = t[1], p = t[2];
      var a = 1 + 4 * (m - o) / (p - o), b = 1 + 4 * (p - m) / (p - o);
      var ga = gamma(a), gb = gamma(b);
      return o + (ga / (ga + gb)) * (p - o);
    };
    var once = function () { return pert(TASKS.design) + Math.max(pert(TASKS.backend), pert(TASKS.frontend)) + pert(TASKS.release); };
    var pct = function (sorted, q) { return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]; };
    var workdate = function (days) {
      var d = new Date(), left = Math.ceil(days);
      while (left > 0) { d.setDate(d.getDate() + 1); var w = d.getDay(); if (w !== 0 && w !== 6) left--; }
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    };
    var el = function (name, attrs, text) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      if (text) n.textContent = text;
      return n;
    };
    var draw = function (samples, final) {
      var sorted = samples.slice().sort(function (x, y) { return x - y; });
      var lo = 10, hi = 27, W = 320, H = 150, top = 14, base = H - 14;
      var counts = new Array(BINS).fill(0);
      samples.forEach(function (s) { var i = Math.floor((s - lo) / (hi - lo) * BINS); if (i >= 0 && i < BINS) counts[i]++; });
      var max = Math.max.apply(null, counts) || 1;
      var p50 = pct(sorted, 0.5), p80 = pct(sorted, 0.8), p95 = pct(sorted, 0.95);
      var xOf = function (v) { return (v - lo) / (hi - lo) * W; };
      while (simChart.firstChild) simChart.removeChild(simChart.firstChild);
      var bw = W / BINS;
      counts.forEach(function (c, i) {
        var mid = lo + (i + 0.5) * (hi - lo) / BINS;
        var cls = mid <= p50 ? "bar b50" : mid <= p80 ? "bar b80" : mid <= p95 ? "bar b95" : "bar";
        var h = (c / max) * (base - top);
        simChart.appendChild(el("rect", { "class": cls, x: (i * bw + 1).toFixed(1), y: (base - h).toFixed(1), width: (bw - 2).toFixed(1), height: h.toFixed(1), rx: 1.5 }));
      });
      simChart.appendChild(el("line", { x1: 0, x2: W, y1: base + 0.5, y2: base + 0.5, stroke: "rgba(200,214,255,.18)" }));
      if (final) {
        [[p50, "#5eead4", "P50"], [p80, "#a78bfa", "P80"], [p95, "#fbbf24", "P95"]].forEach(function (m) {
          var x = xOf(m[0]).toFixed(1);
          simChart.appendChild(el("line", { "class": "pline", x1: x, x2: x, y1: top - 4, y2: base, stroke: m[1] }));
          simChart.appendChild(el("text", { "class": "ptext", x: (+x + 3).toFixed(1), y: top + 2, fill: m[1] }, m[2]));
        });
        simChart.appendChild(el("text", { "class": "ptext", x: 2, y: H - 2, fill: "#5b667c" }, lo + " working days"));
        simChart.appendChild(el("text", { "class": "ptext", x: W - 2, y: H - 2, fill: "#5b667c", "text-anchor": "end" }, hi + " d"));
        document.getElementById("p50").textContent = workdate(p50);
        document.getElementById("p80").textContent = workdate(p80);
        document.getElementById("p95").textContent = workdate(p95);
      }
    };
    var simTimer = null;
    var runSim = function () {
      clearTimeout(simTimer);
      var samples = [];
      if (reduceMotion) { for (var i = 0; i < SIMS; i++) samples.push(once()); return draw(samples, true); }
      (function batch() {
        for (var j = 0; j < 100 && samples.length < SIMS; j++) samples.push(once());
        var done = samples.length >= SIMS;
        draw(samples, done);
        if (!done) simTimer = setTimeout(batch, 45);
      })();
    };
    document.getElementById("sim-run").addEventListener("click", runSim);
    if ("IntersectionObserver" in window) {
      var simStarted = false;
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !simStarted) { simStarted = true; runSim(); }
      }, { threshold: 0.3 }).observe(document.getElementById("sim"));
    } else { runSim(); }
  }

  // ---- counters ----
  function countUp(el) {
    var target = +el.getAttribute("data-target");
    if (reduceMotion) { el.textContent = target; return; }
    var start = performance.now(), dur = 1400;
    function step(now) {
      var k = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    }
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  // ---- reveal on scroll ----
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        var c = en.target.querySelector(".count");
        if (c) countUp(c);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el, idx) { el.style.transitionDelay = (idx % 3) * 80 + "ms"; io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // ---- active nav link ----
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav nav a"));
  var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); }).filter(Boolean);
  if ("IntersectionObserver" in window) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (s) { navIO.observe(s); });
  }
})();
