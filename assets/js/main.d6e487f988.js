// Candemkey web — paketlenmiş modül (scripts/build.mjs). Kaynak: web/src/js/
// src/js/motion/env.js
const __m0=(()=>{
const mq = matchMedia('(prefers-reduced-motion: reduce)');
const rmSubs = new Set();
const visSubs = new Set();
mq.addEventListener('change', () => rmSubs.forEach((f) => f(mq.matches)));
document.addEventListener('visibilitychange', () => visSubs.forEach((f) => f(!document.hidden)));
const reduced = () => mq.matches;
function onReduced(fn) {
rmSubs.add(fn);
return () => rmSubs.delete(fn);
}
function onVisible(fn) {
visSubs.add(fn);
return () => visSubs.delete(fn);
}
function timeline(events, end, loop = true) {
const ev = events.slice().sort((a, b) => a.at - b.at);
let i = 0, t = 0, last = 0, raf = 0, timer = 0, on = false, slept = false;
const flush = () => { while (i < ev.length && ev[i].at <= t) ev[i++].fn(); };
function frame(now) {
let d = now - last;
if (!slept) d = Math.min(d, 250); // takılmadan sonra sıçrama yok
slept = false;
last = now;
t += d;
flush();
if (t >= end) {
if (!loop) { on = false; return; }
i = 0; t = 0; flush();
}
const next = i < ev.length ? ev[i].at : end;
const gap = next - t;
if (gap > 300) {
slept = true;
timer = setTimeout(() => { raf = requestAnimationFrame(frame); }, gap - 60);
} else {
raf = requestAnimationFrame(frame);
}
}
return {
play() {
if (on) return;
on = true;
slept = false;
last = performance.now();
raf = requestAnimationFrame(frame);
},
pause() {
on = false;
cancelAnimationFrame(raf);
clearTimeout(timer);
},
restart() { i = 0; t = 0; },
get running() { return on; },
};
}
return {reduced,onReduced,onVisible,timeline};
})();
// src/js/motion/reveal.js
const __m1=(()=>{
const {reduced,onReduced}=__m0;
function initReveal(scope = document) {
const els = [...scope.querySelectorAll('[data-reveal]')];
const all = () => els.forEach((el) => el.classList.add('is-in'));
if (!els.length) return;
if (reduced() || !('IntersectionObserver' in window)) return all();
const io = new IntersectionObserver((entries) => {
let n = 0;
for (const e of entries) {
if (!e.isIntersecting) continue;
const el = e.target;
io.unobserve(el);
const d = el.dataset.revealDelay;
el.style.setProperty('--reveal-i', String(Math.min(d ? +d : n++, 3)));
el.classList.add('is-in');
}
}, { rootMargin: '0px 0px -8% 0px' });
els.forEach((el) => io.observe(el));
onReduced((r) => { if (r) { io.disconnect(); all(); } });
}
return {initReveal};
})();
// src/js/motion/loop-control.js
const __m2=(()=>{
const {reduced,onReduced,onVisible}=__m0;
function loop(root, o) {
const th = o.threshold ?? 0.35;
const target = root.querySelector('[data-loop-target]') || root;
const btn = root.querySelector('[data-loop-toggle]');
let seen = false, user = false, held = false, stopped = false, running = false;
function sync() {
const r = reduced();
const run = seen && !document.hidden && !r && !user && !held && !stopped;
if (run !== running) {
running = run;
run ? o.play() : o.pause();
}
root.dataset.loopState = r ? 'still' : run ? 'running' : 'paused';
}
if ('IntersectionObserver' in window) {
new IntersectionObserver((es) => {
const e = es[es.length - 1];
const big = e.rootBounds && e.intersectionRect.height >= e.rootBounds.height * 0.5;
seen = e.isIntersecting && (e.intersectionRatio >= th - 0.01 || big);
sync();
}, { threshold: [0, 0.1, 0.2, th, 0.5, 0.75] }).observe(target);
} else {
seen = true;
}
if (btn) {
const lp = btn.dataset.labelPlay, lz = btn.dataset.labelPause;
btn.addEventListener('click', () => {
user = !user;
if (lp && lz) btn.setAttribute('aria-label', user ? lp : lz);
else btn.setAttribute('aria-pressed', String(user));
btn.dataset.paused = String(user);
sync();
});
}
if (o.hold) {
const set = (v) => () => { held = v; sync(); };
root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') set(true)(); });
root.addEventListener('pointerleave', set(false));
root.addEventListener('focusin', set(true));
root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) set(false)(); });
}
onVisible(sync);
onReduced((r) => {
if (r) { o.pause(); running = false; o.still?.(); } else o.reset?.();
sync();
});
if (reduced()) o.still?.();
sync();
return {
stop() { stopped = true; sync(); },
sync,
};
}
return {loop};
})();
// src/js/motion/type-sim.js
const __m3=(()=>{
const LETTER = /\p{L}/u;
function keyMap(kb) {
const m = new Map();
kb.querySelectorAll('[data-key]').forEach((k) => m.set(k.dataset.key, k));
return m;
}
function press(at, t, el, ms, ch) {
if (!el) return;
at(t, () => {
if (ch) el.dataset.pv = ch; else delete el.dataset.pv;
el.classList.add('is-pressed');
});
at(t + ms, () => el.classList.remove('is-pressed'));
}
function rng(seed) {
let s = seed;
return () => ((s = (s * 16807) % 2147483647) % 41) - 20; // -20…+20
}
function typeSim(at, t, o) {
const { text, out, keys, kb, cells = [], autocorrect: ac, suggestions: sg = {}, lang } = o;
const CH = o.char ?? 95, SP = o.space ?? 140, HOLD = o.hold ?? 90;
const jit = rng(7);
const shiftKey = keys.get('shift');
const setShift = (on) => at(t, () => { kb.dataset.shift = on ? 'on' : 'off'; });
let s = text, acEnd = -1;
if (ac) {
const esc = ac.to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const m = new RegExp(`(^|\\s)${esc}(?=\\s|$)`, 'u').exec(text);
if (m) {
const i = m.index + m[1].length;
s = text.slice(0, i) + ac.from + text.slice(i + ac.to.length);
acEnd = i + ac.from.length;
}
}
const finals = text.split(' ');
let strip = '';
const show = (list, cand) => {
const key = list.join('|') + cand;
if (key === strip) return;
strip = key;
at(t, () => cells.forEach((c, j) => {
c.textContent = list[j] || '';
c.classList.toggle('is-candidate', cand && j === 1);
}));
};
let shift = true, word = 0, ws = 0;
for (let i = 0; i < s.length; i++) {
const ch = s[i];
if (ch === ' ') {
if (i === acEnd) {
const len = ac.from.length, at0 = i - len;
press(at, t, cells[1], 120);
at(t, () => out.replaceData(at0, len, ac.to));
}
press(at, t, keys.get('space'), HOLD);
at(t, () => out.appendData(' '));
show([], false);
word++;
ws = i + 1;
t += SP;
continue;
}
const lo = ch.toLocaleLowerCase(lang);
if (ch !== lo && !shift) { // ortada büyük harf: önce shift
press(at, t, shiftKey, HOLD);
shift = true; setShift(true);
t += 110;
}
press(at, t, keys.get(lo), HOLD, LETTER.test(ch) ? ch : '');
at(t, () => out.appendData(ch));
if (shift) { shift = false; setShift(false); }
const part = s.slice(ws, i + 1);
if (ac && part === ac.from && i + 1 === acEnd) show(ac.strip, true);
else if (part.length >= 2 && sg[finals[word]?.toLocaleLowerCase(lang)]) show(sg[finals[word].toLocaleLowerCase(lang)], false);
else show([], false);
t += CH + jit();
}
show([], false);
return t;
}
return {keyMap,press,typeSim};
})();
// src/js/motion/stream-text.js
const __m4=(()=>{
const SIZES = [2, 1, 3, 2, 1, 2, 3]; // sabit desen: her döngüde aynı ritim
function chunkify(el, text) {
const words = text.split(/\s+/).filter(Boolean);
const spans = [];
for (let i = 0, k = 0; i < words.length; k++) {
const n = SIZES[k % SIZES.length];
const s = document.createElement('span');
s.dataset.chunk = '';
s.textContent = words.slice(i, i + n).join(' ') + (i + n < words.length ? ' ' : '');
spans.push(s);
i += n;
}
el.replaceChildren(...spans);
return spans;
}
function streamEvents(at, t, spans, dur = 1600) {
const gap = Math.max(70, dur / Math.max(spans.length, 1));
spans.forEach((s, i) => at(t + i * gap, () => s.classList.add('is-on')));
return t + Math.max(dur, spans.length * gap);
}
function resetChunks(spans, hidden = true) {
spans.forEach((s) => s.classList.toggle('is-on', !hidden));
}
return {chunkify,streamEvents,resetChunks};
})();
// src/js/motion/hero-demo.js
const __m5=(()=>{
const {timeline}=__m0;
const {loop}=__m2;
const {keyMap,press,typeSim}=__m3;
const {chunkify,streamEvents,resetChunks}=__m4;
function initHero(root) {
const $ = (s) => root.querySelector(s);
const script = $('script[data-demo-script]');
const stage = $('[data-demo-stage]');
const kb = $('[data-demo-kb]');
const textEl = $('[data-demo-text]');
const applied = $('[data-demo-applied]');
const result = $('[data-demo-result]');
if (!script || !stage || !kb || !textEl || !result) return;
const d = JSON.parse(script.textContent);
const lang = d.lang || root.closest('[lang]')?.lang || 'tr';
const keys = keyMap(kb);
const cells = [...root.querySelectorAll('[data-demo-sugg]')];
const chip = $(`[data-chip="${d.chip}"]`);
const apply = $('[data-demo-apply]');
const steps = [...root.querySelectorAll('[data-demo-step]')];
const out = document.createTextNode('');
textEl.replaceChildren(out);
if (applied) applied.textContent = d.result;
const chunks = chunkify(result, d.result);
let step = '';
const setStep = (n) => {
if (n === step) return;
step = n;
root.dataset.step = n;
steps.forEach((s) => s.classList.toggle('is-active', s.dataset.demoStep === n));
};
const S = (k, v) => { stage.dataset[k] = v; };
function clearPressed() {
root.querySelectorAll('.is-pressed').forEach((e) => e.classList.remove('is-pressed'));
}
function reset() {
clearPressed();
out.data = '';
cells.forEach((c) => { c.textContent = ''; c.classList.remove('is-candidate'); });
kb.dataset.shift = 'on';
chip?.classList.remove('is-selected');
resetChunks(chunks, true);
S('mode', 'keyboard'); S('panel', 'idle'); S('field', 'empty');
delete stage.dataset.typing;
setStep('1');
}
function still() {
clearPressed();
out.data = d.typed;
cells.forEach((c) => { c.textContent = ''; c.classList.remove('is-candidate'); });
kb.dataset.shift = 'off';
chip?.classList.add('is-selected');
resetChunks(chunks, false);
S('mode', 'panel'); S('panel', 'done'); S('field', 'typing');
delete stage.dataset.typing;
setStep('all');
}
const E = [];
const at = (t, fn) => E.push({ at: t, fn });
at(0, reset);
at(600, () => { S('field', 'typing'); stage.dataset.typing = ''; });
const T = typeSim(at, 600, {
text: d.typed, out, keys, kb, cells, lang,
autocorrect: d.autocorrect, suggestions: d.suggestions,
char: d.timing?.char, space: d.timing?.space,
});
at(T, () => { delete stage.dataset.typing; });
press(at, T + 600, keys.get('ai'), 120);
at(T + 600, () => setStep('2'));
at(T + 750, () => S('mode', 'panel'));
press(at, T + 1700, chip, 100);
at(T + 1700, () => setStep('3'));
at(T + 1800, () => { chip?.classList.add('is-selected'); S('panel', 'loading'); });
at(T + 2200, () => S('panel', 'streaming'));
const R = streamEvents(at, T + 2200, chunks, 1600);
at(R, () => S('panel', 'done'));
press(at, R + 1000, apply, 120);
at(R + 1000, () => setStep('4'));
at(R + 1150, () => { S('mode', 'keyboard'); S('field', 'applied'); });
at(R + 4500, () => { S('field', 'out'); chip?.classList.remove('is-selected'); });
const end = R + 4800;
const tl = timeline(E, end, true);
reset();
root.dataset.demoReady = '';
loop(root, {
play: tl.play,
pause: tl.pause,
still() { tl.restart(); still(); },
reset() { tl.restart(); reset(); },
threshold: 0.35,
});
}
return {initHero};
})();
// src/js/motion/cycle.js
const __m6=(()=>{
const {timeline}=__m0;
const {loop}=__m2;
function initCycle(root) {
const items = [...root.querySelectorAll('[data-cycle-item]')];
if (items.length < 2) return;
const panes = [...root.querySelectorAll('[data-cycle-pane]')];
const ms = +root.dataset.cycleInterval || 4000;
const attr = (it) => (it.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed');
let idx = Math.max(0, items.findIndex((it) => it.getAttribute(attr(it)) === 'true'));
function select(i, user, quiet) {
idx = i;
const item = items[i], key = item.dataset.cycleItem;
items.forEach((it, j) => it.setAttribute(attr(it), String(j === i)));
panes.forEach((p) => {
const on = p.dataset.cyclePane === key;
p.toggleAttribute('data-active', on);
if (!p.parentElement?.closest('[aria-hidden="true"]')) {
if (on) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true');
}
});
root.dataset.current = key;
if (!quiet) root.dispatchEvent(new CustomEvent('cycle:change', { detail: { key, item, user } }));
}
const tl = timeline([{ at: ms, fn: () => select((idx + 1) % items.length, false) }], ms, true);
const ctl = loop(root, { play: tl.play, pause: tl.pause, threshold: 0.35, hold: true });
root.addEventListener('click', (e) => {
const it = e.target.closest('[data-cycle-item]');
if (!it || !root.contains(it)) return;
ctl.stop();
select(items.indexOf(it), true);
});
select(idx, false, true);
}
return {initCycle};
})();
// src/js/motion/text-morph.js
const __m7=(()=>{
const {reduced}=__m0;
const MAX = 140;   // bundan uzun metinde karakter morph yerine çapraz geçiş
const CHAR = 180;  // karakter başına geçiş süresi (ms)
const SPREAD = 400; // kademelendirmenin toplam üst sınırı (ms) → toplam ≤ 600 ms
const mk = (tag, cls, txt) => {
const e = document.createElement(tag);
if (cls) e.className = cls;
if (txt != null) e.textContent = txt;
return e;
};
function morph(el, next) {
const prev = el.textContent;
if (prev === next) return;
clearTimeout(el._ckT);
if (reduced()) { el.textContent = next; return; }
if (next.length > MAX) return swap(el, next);
let p = 0;
while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
const n = next.length - p;
const step = Math.min(14, SPREAD / Math.max(n, 1));
const vis = mk('span', 'ck-morph');
vis.setAttribute('aria-hidden', 'true');
let idx = 0;
for (const part of next.split(/(\s+)/)) {
if (!part) continue;
if (/^\s+$/.test(part)) { vis.append(part); idx += part.length; continue; }
const w = mk('span', 'ck-morph-w');
for (const ch of part) {
const c = mk('span', 'ck-morph-c', ch);
if (idx >= p) {
c.classList.add('is-pre');
c.style.transitionDelay = `${Math.round((idx - p) * step)}ms`;
}
w.append(c);
idx += ch.length;
}
vis.append(w);
}
el.replaceChildren(mk('span', 'ck-sr', next), vis);
requestAnimationFrame(() => requestAnimationFrame(() => vis.classList.add('is-go')));
el._ckT = setTimeout(() => { el.textContent = next; }, CHAR + n * step + 80);
}
function swap(el, next) {
clearTimeout(el._ckT);
if (reduced()) { el.textContent = next; return; }
el.classList.add('is-swapping');
el._ckT = setTimeout(() => {
el.textContent = next;
el.classList.remove('is-swapping');
}, 150);
}
function sizers(box, texts) {
for (const t of texts) {
const s = mk('span', 'ck-sizer', t);
s.setAttribute('aria-hidden', 'true');
box.append(s);
}
}
return {morph,swap,sizers};
})();
// src/js/motion/ai-actions.js
const __m8=(()=>{
const {reduced}=__m0;
const {initCycle}=__m6;
const {morph,sizers}=__m7;
function initAiActions(root) {
const target = root.querySelector('[data-morph]');
const rail = root.querySelector('[data-chip-rail]');
const chips = [...root.querySelectorAll('[data-after]')];
if (!target) return;
const box = target.closest('[data-morph-box]');
if (box) sizers(box, chips.map((c) => c.dataset.after));
root.addEventListener('cycle:change', ({ detail: { item, user } }) => {
if (item.dataset.after != null) morph(target, item.dataset.after);
if (!user && rail && rail.scrollWidth > rail.clientWidth) {
const x = item.getBoundingClientRect().left - rail.getBoundingClientRect().left;
rail.scrollTo({ left: rail.scrollLeft + x - 8, behavior: reduced() ? 'auto' : 'smooth' });
}
});
initCycle(root);
}
return {initAiActions};
})();
// src/js/motion/sliders.js
const __m9=(()=>{
const {swap}=__m7;
function initPresets(root) {
const btns = [...root.querySelectorAll('[data-preset]')];
const sliders = [...root.querySelectorAll('[data-slider]')];
const reply = root.querySelector('[data-preset-reply]');
root.addEventListener('click', (e) => {
const b = e.target.closest('[data-preset]');
if (!b || !root.contains(b) || b.getAttribute('aria-pressed') === 'true') return;
btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
(b.dataset.values || '').split(',').forEach((v, i) => {
const s = sliders[i];
if (!s) return;
s.style.setProperty('--v', v.trim());
if (s.dataset.aria) s.setAttribute('aria-label', s.dataset.aria.replace('{value}', Math.round(+v * 100)));
});
if (reply && b.dataset.reply != null) swap(reply, b.dataset.reply);
});
}
return {initPresets};
})();
// src/js/motion/index.js
const __m10=(()=>{
const {initReveal}=__m1;
const {initHero}=__m5;
const {initAiActions}=__m8;
const {initCycle}=__m6;
const {initPresets}=__m9;
function initHeader(doc) {
const h = doc.querySelector('[data-header]');
if (!h || !('IntersectionObserver' in window)) return;
const s = doc.createElement('div');
s.setAttribute('aria-hidden', 'true');
s.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none';
doc.body.prepend(s);
new IntersectionObserver(([e]) => h.toggleAttribute('data-scrolled', !e.isIntersecting)).observe(s);
}
function initMotion(doc = document) {
const each = (sel, fn) => doc.querySelectorAll(sel).forEach((el) => {
try { fn(el); } catch (err) { console.error(err); } // bir demo bozulursa diğerleri çalışsın
});
initHeader(doc);
initReveal(doc);
each('[data-demo="hero"]', initHero);
each('[data-ai-actions]', initAiActions);
each('[data-cycle]:not([data-ai-actions])', initCycle);
each('[data-presets]', initPresets);
doc.documentElement.classList.add('motion-ready');
}
return {initMotion};
})();
// src/js/main.js
const __m11=(()=>{
const {initMotion}=__m10;
const LANG_KEY = 'ck-lang';
function rememberLang(lang) {
try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* depolama yok: sorun değil */ }
}
function initScale(doc) {
const slots = doc.querySelectorAll('[data-scale-slot]');
if (!slots.length || !('ResizeObserver' in window)) return;
const ro = new ResizeObserver((entries) => {
for (const e of entries) {
const box = e.target.querySelector('.scale-box');
if (!box) continue;
const bw = +box.dataset.bw || 360;
const max = +box.dataset.max || 1;
const w = e.contentRect.width;
if (!w) continue;
box.style.setProperty('--s', Math.min(max, w / bw).toFixed(4));
}
});
slots.forEach((s) => ro.observe(s));
}
function initLangMenu(doc) {
const menus = [...doc.querySelectorAll('[data-lang-menu]')];
const close = (m, focus) => {
if (!m.open) return;
m.open = false;
if (focus) m.querySelector('summary')?.focus();
};
doc.addEventListener('keydown', (e) => {
if (e.key !== 'Escape') return;
menus.forEach((m) => { if (m.open) close(m, m.contains(doc.activeElement)); });
});
doc.addEventListener('click', (e) => {
menus.forEach((m) => { if (m.open && !m.contains(e.target)) close(m, false); });
});
doc.addEventListener('focusin', (e) => {
menus.forEach((m) => { if (m.open && !m.contains(e.target)) close(m, false); });
});
doc.addEventListener('click', (e) => {
const a = e.target.closest?.('[data-lang-link]');
if (a) rememberLang(a.dataset.langLink);
});
}
initScale(document);
initLangMenu(document);
initMotion();
return {rememberLang};
})();
