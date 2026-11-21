(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
  const BG = css("--bg") || "#0c0e12";
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  /* Reveal on scroll, with a small stagger between siblings */
  const revealEls = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    revealEls.forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      el.style.setProperty("--d", `${Math.max(0, sibs.indexOf(el)) * 0.07}s`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach((el) => io.observe(el));
  }

  /* Nav state, progress bar, active section */
  const nav = document.getElementById("nav");
  const bar = document.getElementById("progress-bar");
  const links = [...document.querySelectorAll(".nav li a")];
  const sections = links.map((a) => document.querySelector(a.getAttribute("href"))).filter(Boolean);
  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle("scrolled", y > 24);
    bar.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
    let current = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= window.innerHeight * 0.4) current = s.id;
    links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${current}`));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Count-up for the hero numbers */
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = Number(el.dataset.count);
    if (reduced || !Number.isFinite(target)) return;
    const start = performance.now();
    const dur = 1200;
    el.textContent = "0";
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 500);
  });

  /* Cards: a soft spotlight follows the pointer (the glow itself is drawn in CSS) */
  if (!reduced) {
    document.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
  }

  /* Traceability chain: break and repair it to show what the check reports */
  const chainBox = document.getElementById("chain-box");
  const chainBtn = document.getElementById("chain-toggle");
  if (chainBox && chainBtn) {
    const status = document.getElementById("chain-status");
    const chkTest = document.getElementById("chk-test");
    const lastNum = chainBox.querySelector(".node.last .n-num");
    chainBtn.addEventListener("click", () => {
      const broken = chainBox.dataset.broken !== "true";
      chainBox.dataset.broken = String(broken);
      chainBtn.setAttribute("aria-pressed", String(broken));
      chainBtn.textContent = broken ? "Repair the chain" : "Break the chain";
      chkTest.dataset.ok = String(!broken);
      lastNum.textContent = broken ? "19" : "20";
      status.textContent = broken
        ? "Check failed: 1 of 20 requirements has no test case. The build stops until it is fixed."
        : "All checks pass. The chain is complete.";
    });
  }

  /* Interactive demo: speed and separation monitoring as a toy model.
     The zone sizes are made up for the picture; see the note on the page. */
  const zones = document.getElementById("zones");
  const demoBox = document.getElementById("demo-box");
  if (zones && demoBox && zones.getContext && zones.getContext("2d")) {
    const zc = zones.getContext("2d");
    const out = {
      state: document.getElementById("d-state"), dist: document.getElementById("d-dist"),
      speed: document.getElementById("d-speed"), meter: document.getElementById("d-meter"),
    };
    const OK = css("--ok") || "#8ab4ff", CAUTION = css("--accent") || "#ffc400", STOP = css("--stop") || "#ff5a4f";
    const Z = { stop: 0.3, reduced: 0.62, full: 0.9 };            // zone radii as a fraction of R
    const LABEL = { full: "Full speed", slow: "Slowing down", reduced: "Reduced speed", stop: "Protective stop" };
    const COLOUR = { full: OK, slow: CAUTION, reduced: CAUTION, stop: STOP };
    const stateFor = (dn) => (dn < Z.stop ? "stop" : dn < Z.reduced ? "reduced" : dn < Z.full ? "slow" : "full");
    const targetFor = (dn) => (dn < Z.stop ? 0 : dn < Z.reduced ? 0.25 : dn < Z.full ? 0.25 + 0.75 * (dn - Z.reduced) / (Z.full - Z.reduced) : 1);
    const setText = (node, v) => { if (node.textContent !== v) node.textContent = v; };

    let W = 0, H = 0, cx = 0, cy = 0, R = 0;
    const op = { x: 0.8, y: -0.55 };                              // person position, in units of R from the robot base
    let speed = 1, phase = 0, last = 0, raf = 0, vis = false, dragging = false, state = "full";
    const trail = [];

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = zones.clientWidth; H = zones.clientHeight;
      zones.width = Math.floor(W * dpr); zones.height = Math.floor(H * dpr);
      zc.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2; R = Math.min(W, H) / 2 * 0.94;
    };

    const step = (dt) => {
      const dn = Math.hypot(op.x, op.y);
      const tgt = targetFor(dn);
      speed = reduced ? tgt : speed + (tgt - speed) * Math.min(1, dt * (tgt < speed ? 14 : 4));
      if (!reduced) phase += dt * speed * 1.7;
      state = stateFor(dn);
      demoBox.dataset.state = state;
      setText(out.state, LABEL[state]);
      setText(out.dist, `${(dn * 1.5).toFixed(2)} m`);
      setText(out.speed, `${Math.round(speed * 100)}%`);
      out.meter.style.setProperty("--s", speed.toFixed(3));
    };

    const ring = (r, hex, fillA, strokeA, dash) => {
      zc.beginPath(); zc.arc(cx, cy, r * R, 0, Math.PI * 2);
      zc.fillStyle = rgba(hex, fillA); zc.fill();
      zc.setLineDash(dash || []); zc.lineWidth = 1.5; zc.strokeStyle = rgba(hex, strokeA); zc.stroke(); zc.setLineDash([]);
    };

    const draw = (t) => {
      zc.clearRect(0, 0, W, H);
      const col = COLOUR[state];
      ring(Z.full, OK, state === "full" ? 0.07 : 0.03, 0.4, [5, 6]);
      ring(Z.reduced, CAUTION, state === "slow" || state === "reduced" ? 0.12 : 0.05, 0.55);
      ring(Z.stop, STOP, state === "stop" ? 0.24 : 0.1, 0.7);

      // two-link arm; the swing rate follows the allowed speed
      const a1 = Math.sin(phase * 0.7) * 2.2 + 0.5, a2 = Math.sin(phase * 1.3 + 1) * 1.2;
      const j = { x: cx + Math.cos(a1) * R * 0.34, y: cy + Math.sin(a1) * R * 0.34 };
      const tip = { x: j.x + Math.cos(a1 + a2) * R * 0.28, y: j.y + Math.sin(a1 + a2) * R * 0.28 };
      if (speed > 0.02) { trail.push(tip); if (trail.length > 46) trail.shift(); }
      else if (trail.length) trail.shift();
      for (let i = 1; i < trail.length; i++) {
        zc.beginPath(); zc.moveTo(trail[i - 1].x, trail[i - 1].y); zc.lineTo(trail[i].x, trail[i].y);
        zc.strokeStyle = rgba(col, (i / trail.length) * 0.6); zc.lineWidth = 2; zc.stroke();
      }
      zc.lineCap = "butt";
      for (const [a, b] of [[{ x: cx, y: cy }, j], [j, tip]]) {
        zc.beginPath(); zc.moveTo(a.x, a.y); zc.lineTo(b.x, b.y);
        zc.strokeStyle = "#2c3038"; zc.lineWidth = 13; zc.stroke();
        zc.strokeStyle = rgba(col, 0.95); zc.lineWidth = 2; zc.stroke();
      }
      for (const p of [{ x: cx, y: cy, r: 13 }, { ...j, r: 8 }]) {
        zc.beginPath(); zc.arc(p.x, p.y, p.r, 0, Math.PI * 2); zc.fillStyle = BG; zc.fill();
        zc.lineWidth = 2; zc.strokeStyle = rgba(col, 1); zc.stroke();
      }
      zc.fillStyle = col; zc.fillRect(tip.x - 5, tip.y - 5, 10, 10);

      // person marker (a square), with a dashed line back to the robot
      const px = cx + op.x * R, py = cy + op.y * R;
      zc.setLineDash([3, 5]); zc.beginPath(); zc.moveTo(cx, cy); zc.lineTo(px, py);
      zc.strokeStyle = rgba(col, 0.4); zc.lineWidth = 1; zc.stroke(); zc.setLineDash([]);
      const pulse = reduced ? 0 : Math.sin(t / 380) * 3;
      zc.strokeStyle = rgba(col, 0.6); zc.lineWidth = 1.5; zc.strokeRect(px - 15 - pulse, py - 15 - pulse, 30 + pulse * 2, 30 + pulse * 2);
      zc.fillStyle = col; zc.fillRect(px - 7, py - 7, 14, 14);
      zc.font = "11px 'JetBrains Mono', monospace"; zc.textAlign = "center"; zc.fillStyle = rgba("#ebe8e1", 0.8);
      zc.fillText("YOU", px, py - 26);
    };

    const frame = (now) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      step(dt); draw(now);
      if (vis) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (reduced) { step(0.016); draw(0); return; }
      if (!raf && vis) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    const place = (e) => {
      const r = zones.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - r.left, 14), r.width - 14);
      const y = Math.min(Math.max(e.clientY - r.top, 28), r.height - 14);
      op.x = (x - cx) / R; op.y = (y - cy) / R;
      kick();
    };
    zones.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || dragging) place(e); });
    zones.addEventListener("pointerdown", (e) => { dragging = true; zones.setPointerCapture(e.pointerId); place(e); });
    const release = () => { dragging = false; };
    zones.addEventListener("pointerup", release);
    zones.addEventListener("pointercancel", release);
    zones.addEventListener("keydown", (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      op.x = Math.max(-1, Math.min(1, op.x + d[0] * 0.05));
      op.y = Math.max(-0.95, Math.min(0.95, op.y + d[1] * 0.05));
      kick();
    });
    window.addEventListener("resize", () => { size(); kick(); });
    size();
    step(0.016); draw(0);
    new IntersectionObserver(([e]) => { vis = e.isIntersecting; kick(); }).observe(zones);
  }

  /* Hero background: a technical-drawing grid with a crosshair and a live coordinate readout.
     It only redraws when the pointer moves or the window resizes, so it costs almost nothing. */
  const field = document.getElementById("field");
  const fc = field && field.getContext ? field.getContext("2d") : null;
  if (fc) {
    const ACC = css("--accent") || "#ffc400";
    const MINOR = 32, MAJOR = 160;
    let w = 0, h = 0, px = -1, py = -1, queued = false;

    const paint = () => {
      queued = false;
      fc.clearRect(0, 0, w, h);
      fc.lineWidth = 1;
      for (let x = 0; x <= w; x += MINOR) {
        fc.strokeStyle = x % MAJOR === 0 ? "rgba(255,255,255,0.085)" : "rgba(255,255,255,0.035)";
        fc.beginPath(); fc.moveTo(x + 0.5, 0); fc.lineTo(x + 0.5, h); fc.stroke();
      }
      for (let y = 0; y <= h; y += MINOR) {
        fc.strokeStyle = y % MAJOR === 0 ? "rgba(255,255,255,0.085)" : "rgba(255,255,255,0.035)";
        fc.beginPath(); fc.moveTo(0, y + 0.5); fc.lineTo(w, y + 0.5); fc.stroke();
      }
      fc.font = "10px 'JetBrains Mono', monospace";
      fc.fillStyle = "rgba(235,232,225,0.28)";
      fc.textAlign = "left";
      for (let x = MAJOR; x < w; x += MAJOR) fc.fillText(String(x).padStart(4, "0"), x + 4, 90);
      for (let y = MAJOR; y < h; y += MAJOR) fc.fillText(String(y).padStart(4, "0"), 6, y - 4);
      if (px >= 0) {
        const g = fc.createRadialGradient(px, py, 0, px, py, 240);   // soft light under the pointer
        g.addColorStop(0, rgba(ACC, 0.13)); g.addColorStop(1, rgba(ACC, 0));
        fc.fillStyle = g; fc.fillRect(0, 0, w, h);
        fc.strokeStyle = rgba(ACC, 0.75);
        fc.shadowColor = ACC; fc.shadowBlur = 8;
        fc.beginPath(); fc.moveTo(px + 0.5, 0); fc.lineTo(px + 0.5, h); fc.moveTo(0, py + 0.5); fc.lineTo(w, py + 0.5); fc.stroke();
        fc.strokeRect(px - 6.5, py - 6.5, 13, 13);
        fc.shadowBlur = 0;
        const label = `X ${String(Math.round(px)).padStart(4, "0")}  Y ${String(Math.round(py)).padStart(4, "0")}`;
        const lx = px + 120 > w ? px - 124 : px + 14, ly = py + 30 > h ? py - 14 : py + 24;
        fc.fillStyle = BG; fc.fillRect(lx - 4, ly - 12, 112, 18);
        fc.fillStyle = ACC; fc.fillText(label, lx, ly);
      }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = field.clientWidth; h = field.clientHeight;
      field.width = Math.floor(w * dpr); field.height = Math.floor(h * dpr);
      fc.setTransform(dpr, 0, 0, dpr, 0, 0);
      queue();
    };
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (e) => {
      const r = field.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom) { if (px >= 0) { px = py = -1; queue(); } return; }
      px = e.clientX - r.left; py = e.clientY - r.top;
      queue();
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { px = py = -1; queue(); });
    resize();
  }
})();
