/*
 * app.js — page behaviour: transaction log, stat counters, scroll reveal,
 * active nav link. Works without WebGL (the log then runs its own generator).
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var log = document.getElementById("tx-log");
  var rateEl = document.getElementById("tx-rate");
  var MAX_LINES = 14;
  var total = 0;
  var processors = [];
  try { processors = JSON.parse(log.getAttribute("data-processors")); } catch (err) { processors = ["Stripe", "Adyen"]; }

  var LABEL = { ok: ["AUTHORIZED", "s-ok"], pend: ["PENDING", "s-pend"], bad: ["DECLINED", "s-bad"] };

  function stamp() {
    var d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
  }

  function addLine(tx) {
    var li = document.createElement("li");
    var lab = LABEL[tx.status] || LABEL.ok;
    var cells = [["t", stamp()], [lab[1], lab[0]], ["p", tx.provider + " · " + tx.method], ["ms", tx.ms + "ms"]];
    cells.forEach(function (c) {
      var span = document.createElement("span");
      span.className = c[0];
      span.textContent = c[1];
      li.appendChild(span);
    });
    log.appendChild(li);
    while (log.children.length > MAX_LINES) log.removeChild(log.firstChild);
    total += 1;
    rateEl.textContent = total.toLocaleString() + " tx";
  }

  var heroVisible = true;
  window.addEventListener("tx", function (ev) { if (heroVisible) addLine(ev.detail); });

  // Fallback generator for no-WebGL and reduced motion.
  function fake() {
    var x = Math.random();
    return {
      provider: processors[(Math.random() * processors.length) | 0],
      status: x < 0.82 ? "ok" : x < 0.93 ? "pend" : "bad",
      method: ["card", "3ds", "wallet", "pix", "upi", "refund"][(Math.random() * 6) | 0],
      ms: 90 + ((Math.random() * 160) | 0)
    };
  }
  if (reduceMotion || !window.__sceneReady) {
    for (var i = 0; i < 12; i++) addLine(fake());
    if (!reduceMotion) setInterval(function () { if (heroVisible) addLine(fake()); }, 450);
  }

  // Stop printing while the hero is off screen (keeps the DOM quiet).
  var hero = document.querySelector(".hero");
  if ("IntersectionObserver" in window && hero) {
    new IntersectionObserver(function (entries) { heroVisible = entries[0].isIntersecting; }).observe(hero);
  }

  // ---- counters ----
  function countUp(el) {
    var target = +el.getAttribute("data-target");
    if (reduceMotion) { el.textContent = target; return; }
    var start = performance.now(), dur = 1400;
    function step(now) {
      var k = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(target * eased);
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
        var el = en.target;
        el.classList.add("in");
        var c = el.querySelector(".count");
        if (c) countUp(c);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el, idx) {
      el.style.transitionDelay = (idx % 4) * 70 + "ms";
      io.observe(el);
    });
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
