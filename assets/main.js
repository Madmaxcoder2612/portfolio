(() => {
  "use strict";
  const root = document.documentElement;
  root.classList.add("js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* Reveal on scroll, with a small stagger between siblings */
  const revealEls = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("in"));
  } else {
    revealEls.forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
      el.style.setProperty("--d", `${Math.max(0, sibs.indexOf(el)) * 0.08}s`);
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

  /* Cards: cursor spotlight, plus a very small 3D tilt on fine pointers */
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      card.style.setProperty("--mx", `${x}px`);
      card.style.setProperty("--my", `${y}px`);
      if (!reduced && finePointer) {
        const rx = ((y / r.height) - 0.5) * -4, ry = ((x / r.width) - 0.5) * 4;
        card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
      }
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

  /* Soft light that follows the mouse, and buttons that lean towards it */
  if (!reduced && finePointer) {
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);
    let gx = 0, gy = 0, tx = 0, ty = 0, gr = 0, shown = false;
    const glide = () => {
      gx += (tx - gx) * 0.14; gy += (ty - gy) * 0.14;
      glow.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
      gr = Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5 ? requestAnimationFrame(glide) : 0;
    };
    window.addEventListener("pointermove", (e) => {
      tx = e.clientX; ty = e.clientY;
      if (!shown) { gx = tx; gy = ty; shown = true; glow.classList.add("on"); }
      if (!gr) gr = requestAnimationFrame(glide);
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => { shown = false; glow.classList.remove("on"); });

    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * 0.25;
        const y = (e.clientY - (r.top + r.height / 2)) * 0.35;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${(y - 2).toFixed(1)}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
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
    const css = (n) => getComputedStyle(root).getPropertyValue(n).trim();
    const ACCENT = css("--accent") || "#9b8cff", AMBER = css("--amber") || "#f5b84b", RED = "#ff6b6b";
    const rgba = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    };
    const Z = { stop: 0.3, reduced: 0.62, full: 0.9 };            // zone radii as a fraction of R
    const LABEL = { full: "Full speed", slow: "Slowing down", reduced: "Reduced speed", stop: "Protective stop" };
    const COLOUR = { full: ACCENT, slow: AMBER, reduced: AMBER, stop: RED };
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
      ring(Z.full, ACCENT, state === "full" ? 0.07 : 0.03, 0.32, [5, 6]);
      ring(Z.reduced, AMBER, state === "slow" || state === "reduced" ? 0.12 : 0.05, 0.45);
      ring(Z.stop, RED, state === "stop" ? 0.22 : 0.09, 0.6);

      // two-link arm; the swing rate follows the allowed speed
      const a1 = Math.sin(phase * 0.7) * 2.2 + 0.5, a2 = Math.sin(phase * 1.3 + 1) * 1.2;
      const j = { x: cx + Math.cos(a1) * R * 0.34, y: cy + Math.sin(a1) * R * 0.34 };
      const tip = { x: j.x + Math.cos(a1 + a2) * R * 0.28, y: j.y + Math.sin(a1 + a2) * R * 0.28 };
      if (speed > 0.02) { trail.push(tip); if (trail.length > 46) trail.shift(); }
      else if (trail.length) trail.shift();
      for (let i = 1; i < trail.length; i++) {
        zc.beginPath(); zc.moveTo(trail[i - 1].x, trail[i - 1].y); zc.lineTo(trail[i].x, trail[i].y);
        zc.strokeStyle = rgba(col, (i / trail.length) * 0.55); zc.lineWidth = 2; zc.stroke();
      }
      zc.lineCap = "round";
      for (const [a, b] of [[{ x: cx, y: cy }, j], [j, tip]]) {
        zc.beginPath(); zc.moveTo(a.x, a.y); zc.lineTo(b.x, b.y);
        zc.strokeStyle = "#2a3446"; zc.lineWidth = 13; zc.stroke();
        zc.strokeStyle = rgba(col, 0.9); zc.lineWidth = 2.5; zc.stroke();
      }
      for (const p of [{ x: cx, y: cy, r: 13 }, { ...j, r: 8 }]) {
        zc.beginPath(); zc.arc(p.x, p.y, p.r, 0, Math.PI * 2); zc.fillStyle = "#0a0d12"; zc.fill();
        zc.lineWidth = 2; zc.strokeStyle = rgba(col, 0.95); zc.stroke();
      }
      zc.beginPath(); zc.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
      zc.shadowColor = col; zc.shadowBlur = 14; zc.fillStyle = col; zc.fill(); zc.shadowBlur = 0;

      // person marker, with a line back to the robot
      const px = cx + op.x * R, py = cy + op.y * R;
      zc.setLineDash([3, 5]); zc.beginPath(); zc.moveTo(cx, cy); zc.lineTo(px, py);
      zc.strokeStyle = rgba(col, 0.35); zc.lineWidth = 1; zc.stroke(); zc.setLineDash([]);
      const pulse = reduced ? 0 : Math.sin(t / 380) * 3;
      zc.beginPath(); zc.arc(px, py, 15 + pulse, 0, Math.PI * 2); zc.strokeStyle = rgba(col, 0.5); zc.lineWidth = 1.5; zc.stroke();
      zc.beginPath(); zc.arc(px, py, 8, 0, Math.PI * 2); zc.fillStyle = col; zc.fill();
      zc.font = "11px 'JetBrains Mono', monospace"; zc.textAlign = "center"; zc.fillStyle = rgba("#e7ecf3", 0.75);
      zc.fillText("you", px, py - 24);
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

  /* Hero background: a dot grid that lights up and drifts away from the cursor */
  const canvas = document.getElementById("field");
  if (!canvas || reduced) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const GAP = 34;
  let w = 0, h = 0, dpr = 1, cols = 0, rows = 0, raf = 0, visible = true;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / GAP) + 1; rows = Math.ceil(h / GAP) + 1;
  };

  const draw = (time) => {
    raf = 0;
    if (!visible) return;
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    ctx.clearRect(0, 0, w, h);
    const R = 170;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const bx = i * GAP, by = j * GAP;
        const wave = Math.sin(time / 1800 + i * 0.35 + j * 0.28) * 0.5 + 0.5;
        const dx = bx - mouse.x, dy = by - mouse.y;
        const d = Math.hypot(dx, dy);
        const near = d < R ? 1 - d / R : 0;
        const push = near * 14;
        const x = bx + (d > 0 ? (dx / d) * push : 0);
        const y = by + (d > 0 ? (dy / d) * push : 0);
        const a = 0.16 + wave * 0.14 + near * 0.7;
        ctx.fillStyle = near > 0.05 ? `rgba(155,140,255,${a.toFixed(3)})` : `rgba(152,163,179,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.1 + near * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    raf = requestAnimationFrame(draw);
  };
  const start = () => { if (!raf && visible) raf = requestAnimationFrame(draw); };

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = e.clientX - r.left; mouse.ty = e.clientY - r.top;
  }, { passive: true });
  window.addEventListener("pointerleave", () => { mouse.tx = mouse.ty = -9999; });
  /* Pause when the hero is off screen or the tab is hidden */
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(canvas);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; start(); });
  start();
})();
