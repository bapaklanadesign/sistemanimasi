/* Swarm Rebuild — port of the reference script: multi-cursor parallel reconstruction of real DOM elements.
   Only inline clip-path is touched on targets; everything else lives in a removable overlay. */
export interface SwarmConfig {
  auto: boolean; speed: number; spread: number; dwell: number;
  cursors: number | null; colors: string[]; names: string[]; order: string[];
  maxElements: number; timeoutMs: number;
}
export const DEFAULT_ORDER = [
  "header a[aria-label], header .j-logo, header [class*='logo']", "header nav a", "header button, header .j-btn",
  "main h1", "main section:first-of-type p", "main img, main svg.j-hero-art, main [data-scene] .j-stage > *",
  "main a.j-btn, main button", "main [class*='card']", "main h2", "main section p", "main table, main dl, main form",
  "main section .j-wrap > *, main section > div, main section > *",
  "footer .j-wrap > *, footer",
];
export const DEFAULT_CONFIG: SwarmConfig = {
  auto: true, speed: 1, spread: 1, dwell: 1, cursors: null,
  colors: ["#FF3B4E", "#168BFF", "#00D4FF", "#2BE38B", "#FFD60A", "#A66BFF", "#FF7200"],
  names: ["Fikih", "Jabar", "Leni", "Adam", "Sugeng", "Akbar", "Yoga"],
  order: DEFAULT_ORDER, maxElements: 140, timeoutMs: 240000,
};
const CSS = `#rb{position:absolute;left:0;top:0;width:100%;overflow:hidden;z-index:2147483000;pointer-events:none}
.rb-cur{position:absolute;left:0;top:0;opacity:0;transition:opacity .4s;will-change:transform}
.rb-cur svg{display:block;width:24px;height:24px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));transition:transform .12s;transform-origin:3px 2px}
.rb-cur.press svg{transform:scale(.78)}
.rb-cur i{position:absolute;left:18px;top:20px;font:600 10px/1 system-ui,sans-serif;font-style:normal;color:#fff;padding:3px 6px;border-radius:6px;white-space:nowrap}
.rb-box{position:absolute;border:1.5px dashed;border-radius:6px;transition:opacity .5s,border-color .2s,background-color .2s}
.rb-scan{position:absolute;width:2px;background:#00D4FF;box-shadow:0 0 12px 3px rgba(0,212,255,.7)}
.rb-rip{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border:2px solid;border-radius:50%;animation:rbr .6s ease-out forwards}
@keyframes rbr{to{transform:scale(5);opacity:0}}
#rb-sweep{position:fixed;left:0;right:0;top:0;height:2px;background:#00D4FF;box-shadow:0 0 18px 4px rgba(0,212,255,.6);z-index:2147483001;pointer-events:none;animation:rbs 1.3s ease-in forwards}
@keyframes rbs{to{transform:translateY(100vh)}}
#rb-hud{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:2147483002;pointer-events:none;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#00D4FF;letter-spacing:1px;text-shadow:0 0 8px rgba(0,212,255,.6);background:rgba(6,23,46,.75);border:1px solid rgba(0,212,255,.3);border-radius:8px;padding:6px 10px}
#rb-skip{position:fixed;right:16px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:2147483002;background:rgba(6,23,46,.85);color:#CFE3FA;border:1px solid rgba(22,139,255,.4);border-radius:999px;padding:8px 16px;font:600 12px system-ui,sans-serif;letter-spacing:.5px;cursor:pointer;pointer-events:auto;min-height:44px;touch-action:manipulation}
#rb-skip:focus-visible{outline:2px solid #00D4FF;outline-offset:2px}
@media (max-width:699px){#rb-hud{left:10px;bottom:calc(12px + env(safe-area-inset-bottom,0px));font-size:9px;line-height:1.35;padding:5px 8px;letter-spacing:.5px;max-width:46vw}
#rb-skip{right:10px;bottom:calc(10px + env(safe-area-inset-bottom,0px));min-height:48px;padding:0 20px;font-size:13px}
.rb-cur svg{width:20px;height:20px}.rb-cur i{left:15px;top:17px;font-size:9px;padding:2px 5px}}`;

type Item = { el: HTMLElement; st: 0 | 1 | 2; r: { l: number; t: number; w: number; h: number } | null; prev: string };
type Cur = { e: HTMLDivElement; c: string; x: number; y: number; st: string; item: Item | null; sm: number; cu: number; t0: number; dur: number; fx: number; fy: number; tx: number; ty: number; dw: number; b: HTMLElement | null; sc: HTMLElement | null };

const cl = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ez = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** Resolve order selectors into unique, visible, non-nested targets. */
export function collectTargets(doc: Document, order: string[], max: number): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const sel of order) {
    let list: HTMLElement[] = [];
    try { list = [...doc.querySelectorAll<HTMLElement>(sel)]; } catch { continue; }
    for (const el of list) {
      if (out.length >= max) return out;
      if (el.closest("#rb,#rb-hud,#rb-skip,[data-sonner-toaster]")) continue;
      if (out.some((o) => o === el || o.contains(el) || el.contains(o))) continue;
      const r = el.getBoundingClientRect();
      const vis = (el as HTMLElement & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ visibilityProperty: true, opacityProperty: true }) ?? true;
      if (r.width > 2 && r.height > 2 && vis && r.top + (doc.defaultView?.scrollY ?? 0) >= 0) out.push(el);
    }
  }
  return out;
}

let cfg: SwarmConfig = { ...DEFAULT_CONFIG };
let running = false;
let stopFn: () => void = () => {};

export function configure(p: Partial<SwarmConfig>) { cfg = { ...cfg, ...p }; }
export function isRunning() { return running; }
export function stop() { stopFn(); }

export function start(p?: Partial<SwarmConfig>): boolean {
  if (running || typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const C = { ...cfg, ...p };
  const D = document, R = D.documentElement, B = D.body, rnd = Math.random;
  const items: Item[] = collectTargets(D, C.order, C.maxElements).map((el) => ({ el, st: 0, r: null, prev: el.style.clipPath }));
  if (!items.length) return false;
  running = true;
  const prevOverflow = R.style.overflow, prevBehavior = R.style.scrollBehavior;
  R.style.scrollBehavior = "auto"; window.scrollTo(0, 0); R.style.overflow = "hidden";
  const mob = innerWidth < 700, nav = navigator as Navigator & { deviceMemory?: number };
  const low = (nav.hardwareConcurrency || 4) <= 2 || (nav.deviceMemory || 4) <= 2;
  const NC = C.cursors || (low ? 3 : innerWidth < 420 ? 4 : mob ? 5 : 7);
  const W = () => innerWidth, H = () => innerHeight, DH = R.scrollHeight;
  const style = D.createElement("style"); style.textContent = CSS; D.head.appendChild(style);
  const ov = D.createElement("div"); ov.id = "rb"; ov.style.height = DH + "px"; ov.setAttribute("aria-hidden", "true"); B.appendChild(ov);
  const hud = D.createElement("div"); hud.id = "rb-hud"; hud.setAttribute("role", "status");
  const skip = D.createElement("button"); skip.id = "rb-skip"; skip.type = "button"; skip.textContent = "LEWATI ANIMASI";
  B.append(hud, skip);
  const timers = new Set<number>();
  const later = (f: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); };
  const mk = (cls: string, css: string) => { const e = D.createElement("div"); e.className = cls; e.style.cssText = css; ov.appendChild(e); return e; };
  let ph = 0, t0 = 0, t1 = 0, done = 0, goal = 0, sy = 0, raf = 0, fr = 0;
  const cs: Cur[] = Array.from({ length: NC }, (_, i) => {
    const c = C.colors[i % C.colors.length] ?? "#00D4FF", e = D.createElement("div"); e.className = "rb-cur";
    e.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 2v17l4.6-4.3 3.2 7.3 2.6-1.1-3.1-7.1H18z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><i style="background:${c}">${C.names[i % C.names.length] ?? "Op" + (i + 1)}</i>`;
    ov.appendChild(e);
    const s = (rnd() * 4) | 0, x = s < 2 ? (s ? W() + 40 : -40) : rnd() * W(), y = s < 2 ? rnd() * H() : s === 2 ? -40 : H() + 40;
    return { e, c, x, y, st: "hold", item: null, sm: 0.8 + rnd() * 0.7, cu: 0, t0: 0, dur: 0, fx: x, fy: y, tx: x, ty: y, dw: 0, b: null, sc: null };
  });
  const active = () => cs.filter((c) => c.item).length;
  function goTo(c: Cur, tx: number, ty: number, now: number) {
    c.fx = c.x; c.fy = c.y; c.tx = tx; c.ty = ty; const d = Math.hypot(tx - c.x, ty - c.y);
    c.dur = cl(((400 + d * 0.8) * c.sm) / C.speed, 450, 2200); c.cu = (rnd() - 0.5) * Math.min(d, 400) * 0.6 * C.spread; c.t0 = now; c.st = "move";
  }
  function claim(c: Cur, now: number) {
    const it = items.find((i) => i.st === 0); if (!it) return;
    const r = it.el.getBoundingClientRect(), s = scrollY; it.r = { l: r.left, t: r.top + s, w: r.width, h: r.height };
    if (!(it.r.t + it.r.h > s + 8 && it.r.t < s + H() - 40)) { if (!active()) { const g = cl(it.r.t - H() * 0.3, 0, Math.max(0, DH - H())); if (g === goal && Math.abs(sy - goal) < 1) { it.st = 2; done++; } else goal = g; } return; }
    it.st = 1; c.item = it; goTo(c, it.r.l + it.r.w * (0.05 + 0.25 * rnd()), it.r.t + it.r.h * (0.3 + 0.4 * rnd()), now);
  }
  function click(c: Cur, now: number) {
    const it = c.item!, r = it.r!;
    const rip = mk("rb-rip", `left:${c.x}px;top:${c.y}px;border-color:${c.c}`); later(() => rip.remove(), 700);
    c.e.classList.add("press"); later(() => c.e.classList.remove("press"), 140);
    c.sc = mk("rb-scan", `left:${r.l}px;top:${r.t}px;height:${r.h}px`);
    it.el.style.clipPath = "inset(0 100% 0 0)"; c.st = "build"; c.t0 = now; c.dur = ((500 + Math.min(r.w, 900) * 0.7) * c.sm) / C.speed;
  }
  function upd(c: Cur, now: number, s: number) {
    if (c.st === "move") {
      const u = cl((now - c.t0) / c.dur, 0, 1), e = ez(u), dx = c.tx - c.fx, dy = c.ty - c.fy, l = Math.hypot(dx, dy) || 1, o = Math.sin(Math.PI * e) * c.cu;
      c.x = c.fx + dx * e - (dy / l) * o; c.y = c.fy + dy * e + (dx / l) * o;
      if (u >= 1) {
        if (c.item) { const r = c.item.r!; c.st = "dwell"; c.t0 = now; c.dw = (150 + rnd() * 250) * C.dwell;
          c.b = mk("rb-box", `left:${r.l}px;top:${r.t}px;width:${r.w}px;height:${r.h}px;border-color:${c.c};background:${c.c}14`);
        } else c.st = "idle";
      }
    } else if (c.st === "dwell") { c.x += Math.sin(now / 90 + c.sm * 9) * 0.25; if (now - c.t0 > c.dw) click(c, now); }
    else if (c.st === "build") {
      const it = c.item!, r = it.r!, u = cl((now - c.t0) / c.dur, 0, 1), p = ez(u);
      it.el.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`; c.sc!.style.left = r.l + r.w * p + "px";
      c.x = r.l + r.w * p; c.y = r.t + r.h * (0.5 + 0.32 * Math.sin(u * 10 + c.sm * 5));
      if (u >= 1) {
        it.el.style.clipPath = it.prev; c.sc!.remove(); const b = c.b!;
        b.style.borderColor = "#2BE38B"; b.style.backgroundColor = "rgba(43,227,139,.18)"; b.style.opacity = "0"; later(() => b.remove(), 700);
        it.st = 2; done++; c.item = null; c.b = c.sc = null; c.st = "idle";
      }
    } else if (c.st === "idle") {
      c.x += Math.sin(now / 400 + c.sm * 9) * 0.3; c.y += Math.cos(now / 500 + c.sm * 7) * 0.3;
      if (c.y < s || c.y > s + H()) goTo(c, rnd() * W(), s + H() * (0.2 + 0.6 * rnd()), now); else if (ph === 2) claim(c, now);
    }
    c.e.style.transform = `translate3d(${c.x}px,${c.y}px,0)`;
  }
  const renderHud = () => { hud.innerHTML = `SWARM REBUILD<br>${NC} OPERATORS<br>${done}/${items.length} ELEMENTS`; };
  function frame(now: number) {
    if (!running) return; raf = requestAnimationFrame(frame);
    try {
      if (!t0) t0 = now;
      if (ph === 0 && now - t0 > 700) {
        ph = 1; t1 = now; const sw = D.createElement("div"); sw.id = "rb-sweep"; B.appendChild(sw);
        cs.forEach((c, i) => later(() => { c.e.style.opacity = "1"; goTo(c, W() * (0.1 + 0.8 * rnd()), H() * (0.2 + 0.6 * rnd()), performance.now()); }, i * 140));
      }
      if (ph === 1) {
        let all = true; const gap = 1100 / items.length / C.speed, dur = 450 / C.speed;
        items.forEach((it, i) => { const u = cl((now - t1 - i * gap) / dur, 0, 1); it.el.style.clipPath = `inset(0 0 0 ${u * 100}%)`; if (u < 1) all = false; });
        if (all && now - t1 > 1500 / C.speed) ph = 2;
      }
      if (ph >= 1) cs.forEach((c) => c.st !== "hold" && upd(c, now, sy));
      if (ph >= 2) {
        if (ph === 2) sy += (goal - sy) * 0.07; if (Math.abs(goal - sy) < 0.5) sy = goal; window.scrollTo(0, sy);
        if (ph === 2 && done === items.length) { ph = 3; goal = 0; cs.forEach((c, i) => later(() => (c.e.style.opacity = "0"), i * 120)); }
        if (ph === 3) { sy += (0 - sy) * 0.03 - Math.sign(sy) * 2; if (sy < 1) { sy = 0; window.scrollTo(0, 0); ph = 4; later(finish, 500); } }
      }
      if (!(fr++ % 6)) renderHud();
    } catch (e) { console.error(e); finish(); }
  }
  const W0 = innerWidth;
  const onR = () => { if (Math.abs(innerWidth - W0) > 120) finish(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
  function finish() {
    if (!running) return; running = false; cancelAnimationFrame(raf);
    timers.forEach((t) => clearTimeout(t)); timers.clear();
    items.forEach((i) => { i.el.style.clipPath = i.prev; if (i.el.getAttribute("style") === "") i.el.removeAttribute("style"); });
    ov.remove(); hud.remove(); skip.remove(); style.remove(); D.getElementById("rb-sweep")?.remove();
    R.style.overflow = prevOverflow; window.scrollTo(0, 0); R.style.scrollBehavior = prevBehavior;
    removeEventListener("resize", onR); removeEventListener("keydown", onKey); stopFn = () => {};
  }
  stopFn = finish;
  later(finish, C.timeoutMs);
  skip.addEventListener("click", finish); addEventListener("resize", onR); addEventListener("keydown", onKey);
  renderHud(); raf = requestAnimationFrame(frame);
  return true;
}

export const SwarmRebuild = { start, stop, configure, isRunning };
declare global { interface Window { SwarmRebuild?: typeof SwarmRebuild } }
