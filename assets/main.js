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
        ctx.fillStyle = near > 0.05 ? `rgba(61,220,151,${a.toFixed(3)})` : `rgba(152,163,179,${a.toFixed(3)})`;
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
