/* ==========================================================
   common.js — общий движок сайта.
   Подключай в <head> БЕЗ defer, после base.css:
       <script src="js/common.js"></script>      (из папки sections/ — ../js/common.js)

   Что умеет:
   1. Переход между страницами: жёсткий чёрный экран, строб, мигающее слово,
      печать бредовой фразы, разъезд полос. Любая ссылка на твой сайт
      подхватывается автоматически.
   2. data-reveal="lines"    строки выезжают из-под маски
      data-reveal="scramble" слово «собирается» из мусора
      data-reveal="flick"    рваное мигание при появлении
      .redact                цензурная плашка (сама открывается при появлении)
      data-delay="300"       задержка перед появлением, мс
   3. data-hover="scramble"  слово пересобирается при наведении
   4. .spot                  фонарик у курсора
   5. Спокойный режим: открой любую страницу с ?calm (выключить: ?calm=0)

   Для своих страниц:
       Veil.go('choose.html')                      переход из кода (например после формы)
       Veil.go('x.html', {word:'ВЕРДИКТ', phrase:'Текст…'})
       Veil.ready.then(() => …)                    когда завеса ушла и можно стартовать
   Для ссылок:  <a href="x.html" data-vt-word="СЛОВО" data-vt-phrase="Фраза">
                <a href="x.html" data-no-vt>  — без перехода
   Для страницы со вступлением: <html lang="ru" data-intro>
   ========================================================== */
(() => {
  'use strict';

  /* ---------- НАСТРОЙКИ: правь здесь ---------- */
  const CONFIG = {
    slices: 14,              // на сколько полос рассыпается экран
    hold: 280,               // пауза после допечатывания фразы, мс
    arrivalHold: 320,        // сколько текст висит на новой странице, мс
    stateTTL: 10000,         // через сколько мс забыть переход (защита от старого)
    type: { min: 22, max: 55, pause: [180, 320], typoChance: 0.045 },
    words: ['ПРОВЕРКА', 'ДОПУСК', 'ВЕРДИКТ', 'ЗАМЕР', 'ЭКСПЕРТИЗА', 'ФРЕЙМ'],
    phrases: [
      'Сверяем твой фрейм с таблицей предков…',
      'Челюсть направлена на независимую экспертизу.',
      'Консультируемся с моггерами по линии матери…',
      'Измеряем скулы по длине фамилии…',
      'Твой кантальный тилт оспаривается.',
      'Запрашиваем разрешение у прабабушки…',
      'Считаем сантиметры до тру адама…',
      'Моггер на линии. Не клади трубку.',
      'Крестьянская кровь не обнаружена. Перепроверяем…',
      'Фиксируем осанку души. Результат плохой.'
    ]
  };

  const root = document.documentElement;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------- спокойный режим ---------- */
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('calm')) {
      if (q.get('calm') === '0') localStorage.removeItem('calm');
      else localStorage.setItem('calm', '1');
    }
    if (localStorage.getItem('calm') === '1') root.classList.add('calm');
  } catch (e) { /* хранилище недоступно: ок */ }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) root.classList.add('calm');

  /* ---------- прячем текст до подготовки (страховка от мелькания) ---------- */
  const guard = document.createElement('style');
  guard.textContent = '[data-reveal]:not(.is-prepped){visibility:hidden}';
  document.head.append(guard);

  /* ---------- пришли с другой страницы или это вступление? ---------- */
  let arrival = null;
  try {
    const raw = sessionStorage.getItem('vt');
    if (raw) {
      sessionStorage.removeItem('vt');
      const s = JSON.parse(raw);
      if (Date.now() - s.t < CONFIG.stateTTL) arrival = s;
    }
  } catch (e) { /* нет так нет */ }
  const intro = !arrival && root.hasAttribute('data-intro');
  if (arrival || intro) root.classList.add('vt-arrive'); // чёрная крышка до готовности

  let readyRes;
  const ready = new Promise((r) => { readyRes = r; });

  /* ==========================================================
     ЗАВЕСА
     ========================================================== */
  let veil, wordEl, textNode;
  let busy = false;

  function buildVeil() {
    const N = CONFIG.slices;
    veil = document.createElement('div');
    veil.className = 'veil';
    veil.setAttribute('aria-hidden', 'true');

    const slices = document.createElement('div');
    slices.className = 'veil__slices';
    for (let i = 0; i < N; i++) {
      const s = document.createElement('div');
      s.className = 'veil__slice';
      s.style.setProperty('--i', i);
      s.style.setProperty('--n', N);
      slices.append(s);
    }

    const stage = document.createElement('div');
    stage.className = 'veil__stage';
    wordEl = document.createElement('div');
    wordEl.className = 'veil__word';
    const type = document.createElement('p');
    type.className = 'veil__type';
    textNode = document.createTextNode('');
    const caret = document.createElement('span');
    caret.className = 'veil__caret';
    type.append(textNode, caret);
    stage.append(wordEl, type);

    veil.append(slices, stage);
    document.body.append(veil);
  }

  function showCut(strobe = true) {
    veil.classList.remove('is-out', 'is-strobe');
    veil.classList.add('is-on');
    root.classList.add('vt-lock');
    if (strobe) {
      void veil.offsetWidth; // перезапуск анимации
      veil.classList.add('is-strobe');
    }
  }

  function flickWord(word) {
    wordEl.textContent = word;
    wordEl.style.opacity = '';
    wordEl.classList.remove('flick');
    void wordEl.offsetWidth;
    wordEl.classList.add('flick');
  }

  async function typeText(text, ctl) {
    const T = CONFIG.type;
    const wrong = [...'ыйцукенгшщзхфвапролджэячсмить'];
    textNode.data = '';
    for (let i = 0; i < text.length; i++) {
      if (ctl.skip) { textNode.data = text; return; }
      const ch = text[i];
      // иногда «опечатка»: неверная буква, пауза, стирание
      if (/[а-яё]/i.test(ch) && i > 6 && i < text.length - 4 && Math.random() < T.typoChance) {
        textNode.data += pick(wrong);
        await sleep(rnd(90, 150));
        textNode.data = textNode.data.slice(0, -1);
        await sleep(rnd(70, 120));
      }
      textNode.data += ch;
      let d = rnd(T.min, T.max);
      if (',.…:;!?—'.includes(ch)) d += rnd(T.pause[0], T.pause[1]);
      await sleep(d);
    }
  }

  function nextPhrase() {
    let last = -1;
    try { last = +sessionStorage.getItem('vt-last'); } catch (e) { /* ок */ }
    let i;
    do { i = Math.floor(Math.random() * CONFIG.phrases.length); } while (i === last && CONFIG.phrases.length > 1);
    try { sessionStorage.setItem('vt-last', i); } catch (e) { /* ок */ }
    return CONFIG.phrases[i];
  }

  async function playIn(state, ctl) {
    showCut();
    await sleep(150);
    flickWord(state.word);
    await sleep(380);
    await typeText(state.phrase, ctl);
    await sleep(ctl.skip ? 120 : CONFIG.hold);
  }

  async function playOut() {
    $$('.veil__slice', veil).forEach((s) => s.style.setProperty('--d', Math.round(rnd(0, 260))));
    veil.classList.remove('is-strobe');
    veil.classList.add('is-out');
    await sleep(450);
    readyRes();               // контент начинает появляться, пока полосы ещё уезжают
    await sleep(600);
    veil.classList.remove('is-on', 'is-out');
    root.classList.remove('vt-lock');
  }

  /* переход на другую страницу: завеса, печать, потом навигация */
  async function go(url, opts = {}) {
    if (busy || !veil) { location.href = url; return; }
    busy = true;
    const state = { word: opts.word || pick(CONFIG.words), phrase: opts.phrase || nextPhrase(), t: Date.now() };
    const ctl = { skip: false };
    const skip = () => { ctl.skip = true; };
    veil.addEventListener('pointerdown', skip);
    addEventListener('keydown', skip);   // любая клавиша или клик: дописать фразу сразу
    await playIn(state, ctl);
    try { sessionStorage.setItem('vt', JSON.stringify(state)); } catch (e) { /* ок */ }
    location.href = url;
  }

  /* ссылки на свой сайт подхватываются автоматически */
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-no-vt')) return;
    const url = new URL(a.href, location.href);
    if (url.protocol !== location.protocol || url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return; // якоря
    e.preventDefault();
    go(url.href, { word: a.dataset.vtWord, phrase: a.dataset.vtPhrase });
  });

  /* кнопка «Назад»: страница вернулась из кэша, а завеса осталась */
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    busy = false;
    root.classList.remove('vt-arrive', 'vt-lock');
    if (veil) veil.classList.remove('is-on', 'is-out', 'is-strobe');
  });

  /* ==========================================================
     ТЕКСТОВЫЕ ЭФФЕКТЫ
     ========================================================== */
  const GARBAGE = 'ЖЩЮЭЫФЯБ#%&@?/<>';

  function scramble(el, dur = 520) {
    if (el._final === undefined) el._final = el.textContent;
    const final = el._final;
    const n = final.length;
    el.style.opacity = '';
    cancelAnimationFrame(el._raf);
    const t0 = performance.now();
    const at = Array.from(final, (_, i) => (i / n) * dur * 0.7 + Math.random() * dur * 0.3);
    const tick = (now) => {
      const t = now - t0;
      let out = '';
      let done = true;
      for (let i = 0; i < n; i++) {
        const c = final[i];
        if (c === ' ' || t >= at[i]) out += c;
        else { out += GARBAGE[Math.floor(Math.random() * GARBAGE.length)]; done = false; }
      }
      el.textContent = done ? final : out;
      if (!done) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  /* разбивка текста на визуальные строки (только простой текст без вложенной разметки) */
  function splitLines(el) {
    if (el._orig === undefined) el._orig = el.textContent.trim().replace(/\s+/g, ' ');
    el.textContent = '';
    const words = el._orig.split(' ').map((w) => {
      const s = document.createElement('span');
      s.textContent = w;
      s.style.display = 'inline-block';
      return s;
    });
    words.forEach((s, i) => { el.append(s); if (i < words.length - 1) el.append(' '); });
    const lines = [];
    let top = null;
    words.forEach((s) => {
      const t = s.offsetTop;
      if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; }
      lines[lines.length - 1].push(s.textContent);
    });
    el.textContent = '';
    lines.forEach((ws, i) => {
      const l = document.createElement('span');
      l.className = 'line';
      l.style.setProperty('--i', i);
      const inner = document.createElement('span');
      inner.className = 'line__in';
      inner.textContent = ws.join(' ');
      l.append(inner);
      el.append(l);
    });
    el._w = el.offsetWidth;
  }

  function prepReveal() {
    $$('[data-reveal]').forEach((el) => {
      const kind = el.dataset.reveal;
      if (kind === 'lines') splitLines(el);
      if (kind === 'scramble' || kind === 'flick') el.style.opacity = '0';
      el.classList.add('is-prepped');
    });
  }

  function reveal(el) {
    el.classList.add('is-in');
    const kind = el.dataset.reveal;
    if (kind === 'scramble') scramble(el);
    if (kind === 'flick') el.classList.add('flick');
  }

  function observeReveal() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const d = +en.target.dataset.delay || 0;
        setTimeout(() => reveal(en.target), d);
      });
    }, { threshold: 0.15 });
    $$('[data-reveal], .redact').forEach((el) => io.observe(el));

    /* при смене ширины окна пересобираем строки */
    let timer;
    addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        $$('[data-reveal="lines"]').forEach((el) => {
          if (Math.abs(el.offsetWidth - (el._w || 0)) > 1) splitLines(el);
        });
      }, 200);
    });
  }

  /* фонарик */
  function initSpot() {
    const spots = $$('.spot');
    if (!spots.length) return;
    if (matchMedia('(hover: none)').matches) { // на телефоне курсора нет: показываем весь текст
      spots.forEach((s) => s.style.setProperty('--r', '9999px'));
      return;
    }
    let x = -9999, y = -9999, queued = false;
    const apply = () => {
      queued = false;
      spots.forEach((s) => {
        const r = s.getBoundingClientRect();
        s.style.setProperty('--mx', (x - r.left) + 'px');
        s.style.setProperty('--my', (y - r.top) + 'px');
      });
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; queue(); }, { passive: true });
    addEventListener('scroll', queue, { passive: true });
    root.addEventListener('mouseleave', () => { x = y = -9999; queue(); });
    apply();
  }

  /* ==========================================================
     СТАРТ
     ========================================================== */
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      buildVeil();
      initSpot();
      $$('[data-hover="scramble"]').forEach((el) => el.addEventListener('pointerenter', () => scramble(el, 320)));

      // ждём шрифты (не дольше 0.7 с), иначе строки порежутся по запасному шрифту
      await Promise.race([document.fonts ? document.fonts.ready : null, sleep(700)]);
      prepReveal();
      ready.then(observeReveal); // контент появляется, как только завеса пошла на выход

      if (arrival) {
        showCut(false);
        wordEl.textContent = arrival.word;
        wordEl.style.opacity = '1';
        textNode.data = arrival.phrase;
        root.classList.remove('vt-arrive');
        await sleep(CONFIG.arrivalHold);
        await playOut();
      } else if (intro) {
        const ctl = { skip: false };
        const skip = () => { ctl.skip = true; };
        veil.addEventListener('pointerdown', skip);
        addEventListener('keydown', skip);
        await sleep(0);
        root.classList.remove('vt-arrive');
        await playIn({ word: pick(CONFIG.words), phrase: nextPhrase() }, ctl);
        await playOut();
      } else {
        readyRes();
      }
    } catch (err) {
      console.error('[common.js]', err);
      guard.remove();
      root.classList.remove('vt-arrive', 'vt-lock');
      readyRes();
    }
  });

  window.Veil = { go, ready };
  window.Fx = { scramble };
})();
