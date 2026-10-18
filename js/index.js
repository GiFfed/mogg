/* ==========================================================
   index.js — страница регистрации.
   Анкета задаёт вопросы по одному, потом «обрабатывает» ответы
   и выносит вердикт. Тексты и вопросы правь в блоке ДАННЫЕ.
   ========================================================== */
(() => {
  'use strict';

  /* ==================== ДАННЫЕ ==================== */

  // Шкала от худшего к лучшему. Вердикт всегда на ступень ниже выбранного.
  // Названия должны совпадать с картинками: img/levels/<название без пробелов>.png
  const LEVELS = ['sub3', 'sub5', 'ltn', 'mtn', 'htn', 'chad', 'true adam'];

  // Сила «божественности» появления портрета: 0 просто появился, 6 пришёл божество
  const TIER = { 'sub3': 0, 'sub5': 1, 'ltn': 2, 'mtn': 3, 'htn': 4, 'chad': 5, 'true adam': 6 };

  // Комментарий к вердикту (по индексу уровня)
  const NOTES = [
    'Нижняя граница шкалы. Система проверила дважды.',
    'Крестьянин. Подтверждено независимой комиссией.',
    'Низкий средний. Это не комплимент.',
    'Средний. Серая масса, ничего личного.',
    'Выше среднего. Для крестьянина — отлично.',
    'Допущен. С оговорками.'
  ];

  // Вопросы. type: choice | text | number | time. max — верхний предел для чисел.
  const QUESTIONS = [
    { key: 'level',   type: 'choice', q: 'Укажи свой уровень по таблице.', hint: 'Выбирай честно. Система всё равно проверит.' },
    { key: 'name',    type: 'text',   q: 'Имя.', hint: 'Как в паспорте. Прозвища не принимаются.' },
    { key: 'surname', type: 'text',   q: 'Фамилия.', hint: 'Полностью, без сокращений.' },
    { key: 'age',     type: 'number', q: 'Возраст.', hint: 'Полных лет. Округление вниз.', max: 120 },
    { key: 'maiden',  type: 'text',   q: 'Девичья фамилия матери.', hint: 'Влияет на всё.' },
    { key: 'grandma', type: 'number', q: 'Возраст прабабушки.', hint: 'Не знаешь — спроси у бабушки. Мы подождём.', max: 130 },
    { key: 'birth',   type: 'time',   q: 'Точное время рождения.', hint: 'С секундами. Сверим с акушеркой.' },
    { key: 'height',  type: 'number', q: 'Рост в сантиметрах.', hint: 'Без обуви и без вранья.', max: 260 },
    { key: 'finger',  type: 'number', q: 'Длина среднего пальца отца в миллиметрах.', hint: 'Измерь линейкой. Оценка на глаз аннулируется.', max: 200 },
    { key: 'mogger',  type: 'text',   q: 'Имя ближайшего моггера.', hint: 'Того, кто тебя уже могнул. Поимённо.' }
  ];

  // ----- давление -----
  const LIMIT = 15;   // секунд на вопрос, потом считается «колебание»
  const NICHES = ['крестьянин', 'могнутый', 'инцел', 'недостойный'];   // за 1, 2, 3 и 4+ колебания
  const PRESS = [                                                       // что сайт говорит на 1, 2, 3, 4+ колебании
    'Ты думаешь слишком долго. Предки замечают.',
    'Уверенные люди отвечают сразу.',
    'Колебание зафиксировано. Категория понижена.',
    'Ты не уверен в своих ответах. Это записано.'
  ];

  // ----- переходы между вопросами -----
  // Ключ: номер вопроса (с 1), на котором человек нажал «Далее». Значение: имя перехода из блока FX.
  // Сдвинуть серию на другие вопросы можно, просто поменяв номера.
  const INTERLUDES = { 4: 'you', 5: 'never', 6: 'reach', 7: 'level', 8: 'divine' };
  // Фон каждого перехода: серия медленно светлеет перед финальным ослеплением
  const INTERLUDE_BG = { you: '#000', never: '#0a0a0a', reach: '#141414', level: '#1f1f1f', divine: '#000' };

  // Сообщения во время «обработки»: [с какой миллисекунды, текст]
  const SCAN_MSGS = [
    [0,    'Измеряем ширину скул по твоему имени…'],
    [1500, 'Сверяем девичью фамилию матери с реестром…'],
    [2600, 'Фрейм выглядит многообещающе…'],
    [4300, 'Подожди. Что-то не так.'],
    [5100, 'Система передумала. Пересчитываем…'],
    [6100, 'Фиксируем результат…'],
    [7300, 'Не закрывай страницу. Предки следят.']
  ];
  const SCAN_END = 8500;   // когда объявляем вердикт, мс
  const SCAN_DROP = 4800;  // когда полоска начинает падать назад, мс

  /* ==================== ЭЛЕМЕНТЫ ==================== */
  const $ = (id) => document.getElementById(id);
  const el = {
    q: $('q'), rest: $('rest'), body: $('body'), hint: $('hint'), err: $('err'), next: $('next'),
    counter: $('counter'), ghost: $('ghost'), clock: $('clock'), formNo: $('formNo'),
    ask: $('ask'), scan: $('scan'), work: $('work'), msg: $('msg'),
    meter: $('meter'), read: $('read'), stripDim: $('stripDim'), stripLit: $('stripLit'), ticks: $('ticks'),
    verdict: $('verdict'), vPre: $('vPre'), vLvl: $('vLvl'), vNote: $('vNote'), vNiche: $('vNiche'), press: $('press'), status: $('status')
  };
  const pad = (n) => String(n).padStart(2, '0');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function retrigger(node, cls, delay = 0) {
    node.classList.remove(cls);
    node.style.animationDelay = delay + 'ms';
    void node.offsetWidth;
    node.classList.add(cls);
  }

  /* ==================== ПОРТРЕТ УРОВНЯ ==================== */
  const portrait = $('portrait');
  const fig = $('fig');
  const flare = $('flare');
  const slug = (lv) => lv.replace(/\s+/g, '');
  const imgSrc = (lv) => `img/levels/${slug(lv)}.png`;

  // заранее грузим все портреты, чтобы не было задержки при наведении
  LEVELS.forEach((lv) => { new Image().src = imgSrc(lv); });

  function showPortrait(lv) {
    const tier = TIER[lv] ?? 0;
    fig.querySelectorAll('img').forEach((im) => { im.src = imgSrc(lv); });
    fig.className = 'portrait__fig';       // сброс прошлого эффекта
    void fig.offsetWidth;                   // перезапуск анимации
    fig.classList.add('tier-' + tier);
    portrait.classList.add('is-on');

    if (tier >= 5) {                        // вспышка экрана для chad и true adam
      flare.className = 'flare';
      void flare.offsetWidth;
      flare.classList.add('is-' + tier);
    }
    if (tier === 6) {                       // и дрожь страницы для true adam
      const reg = document.querySelector('.reg');
      reg.classList.remove('quake');
      void reg.offsetWidth;
      reg.classList.add('quake');
    }
  }

  function hidePortrait() { portrait.classList.remove('is-on'); }

  /* ==================== АНКЕТА ==================== */
  let step = 0;
  let locked = false;
  let timing = false;      // идёт ли отсчёт времени на вопрос
  let qStart = 0;          // когда начался отсчёт текущего вопроса
  let qOver = 0;           // сколько раз уже просрочен текущий вопрос
  let hesitations = 0;     // всего «колебаний» за анкету
  const answers = {};

  function render() {
    const Q = QUESTIONS[step];
    locked = false;
    hidePortrait();
    timing = true;
    qStart = performance.now() + 800;   // отсчёт начинается, когда вопрос уже открылся
    qOver = 0;
    el.press.textContent = '';

    el.counter.textContent = `вопрос ${pad(step + 1)} из ${pad(QUESTIONS.length)}`;
    el.ghost.textContent = pad(step + 1);
    retrigger(el.ghost, 'flick');

    // вопрос: каждый раз новая цензурная плашка, которая уезжает вправо
    const span = document.createElement('span');
    span.className = 'redact';
    span.textContent = Q.q;
    el.q.replaceChildren(span);
    void span.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => span.classList.add('is-in')));

    el.body.replaceChildren(Q.type === 'choice' ? buildChoices() : buildInput(Q));
    el.hint.textContent = Q.hint;
    el.err.textContent = '';
    el.next.hidden = Q.type === 'choice';

    // ответ проступает рваным миганием, когда плашка уже уехала
    retrigger(el.rest, 'flick', 320);

    const input = el.body.querySelector('input');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 750);
  }

  function buildInput(Q) {
    const input = document.createElement('input');
    input.className = 'field__input';
    input.type = Q.type === 'number' ? 'text' : Q.type;
    if (Q.type === 'number') input.inputMode = 'numeric';
    if (Q.type === 'time') input.step = 1;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-label', Q.q);
    if (answers[Q.key] !== undefined) input.value = answers[Q.key];
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); advance(); }
    });
    return input;
  }

  function buildChoices() {
    const wrap = document.createElement('div');
    wrap.className = 'choices';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn choice';
      b.textContent = lv;
      b.addEventListener('pointerenter', () => {
        if (window.Fx) window.Fx.scramble(b, 300);
        showPortrait(lv);
      });
      b.addEventListener('focus', () => showPortrait(lv));   // клавиатура и удержание пальцем
      b.addEventListener('blur', hidePortrait);
      b.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        wrap.querySelectorAll('.is-picked').forEach((x) => x.classList.remove('is-picked'));
        b.classList.add('is-picked');
        answers.level = i;
        setTimeout(advance, 320);
      });
      wrap.append(b);
    });
    wrap.addEventListener('pointerleave', hidePortrait);
    return wrap;
  }

  function check(Q, v) {
    if (!v) return 'Поле обязательно. Пустой ответ засчитывается как слабость.';
    if (Q.type === 'text' && v.length < 2) return 'Слишком коротко. Система не верит.';
    if (Q.type === 'number') {
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n) || n <= 0) return 'Нужно число. Предки считают цифрами.';
      if (Q.max && n > Q.max) return 'Столько не бывает. Перепроверь измерения.';
    }
    return '';
  }

  function advance() {
    if (busy) return;
    const Q = QUESTIONS[step];
    if (Q.type !== 'choice') {
      const v = el.body.querySelector('input').value.trim();
      const err = check(Q, v);
      if (err) {
        el.err.textContent = err;
        retrigger(el.err, 'flick');
        return;
      }
      answers[Q.key] = Q.type === 'number' ? Number(v.replace(',', '.')) : v;
    }
    if (step < QUESTIONS.length - 1) {
      const fx = INTERLUDES[step + 1];
      if (fx && FX[fx]) runInterlude(fx).then(() => { step++; render(); });
      else { step++; render(); }
    } else { scanPhase(); }
  }

  el.next.addEventListener('click', advance);

  /* ==================== ПЕРЕХОДЫ МЕЖДУ ВОПРОСАМИ ==================== */
  let busy = false;      // идёт переход: ввод заблокирован
  let fxSkip = false;    // клик или клавиша ускоряют переход
  new Image().src = 'img/divine.jpg';

  const fxWait = async (ms) => {
    const end = performance.now() + ms;
    while (performance.now() < end && !fxSkip) await sleep(30);
  };
  const kick = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const pulseFlare = (n) => { flare.className = 'flare'; void flare.offsetWidth; flare.classList.add('is-' + n); };
  const mkWord = (L, text, cls) => {
    const w = document.createElement('div');
    w.className = 'fx__word ' + (cls || '');
    w.textContent = text;
    L.append(w);
    return w;
  };

  /* ---- кинематограф: камера (тряска + наезд), пульс по краям, вспышка кадра ---- */
  function rig(L, o) {
    const cam = L.querySelector('.fx__cam');
    const vig = L.querySelector('.fx__vig');
    const t0 = performance.now();
    let alive = true;
    const loop = (now) => {
      if (!alive) return;
      const a = isCalm() ? 0 : o.amp;
      const k = (now - t0) / 1000;
      cam.style.transform = `translate(${((Math.random() - 0.5) * a).toFixed(1)}px, ${((Math.random() - 0.5) * a).toFixed(1)}px) rotate(${((Math.random() - 0.5) * a * 0.03).toFixed(2)}deg) scale(${(1 + o.push * k).toFixed(3)})`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const beat = setInterval(() => { kick(vig, 'is-beat'); }, o.beat);
    const r = { o, stop() { alive = false; clearInterval(beat); } };
    L._rig = r;
    return r;
  }
  const flash = (L, ms = 70) => {          // кадр-вспышка: цвета инвертируются на миг
    if (isCalm()) return;
    L.classList.add('is-invert');
    setTimeout(() => L.classList.remove('is-invert'), ms);
  };

  const FX = {
    // 1. ТЫ: далёкая точка несётся на камеру со шлейфом, удар, вспышка, тряска
    async you(L, C) {
      L.style.setProperty('--bar', '7vh');
      const rg = rig(L, { amp: 2, push: 0.03, beat: 900 });
      for (let k = 0; k < 4; k++) mkWord(C, 'ТЫ', 'fx__word--huge fx-rush').style.setProperty('--k', k);
      await fxWait(1000);
      flash(L, 90); pulseFlare(5);
      C.classList.add('is-hit');
      rg.o.amp = 46; rg.o.push = 0.1;
      for (let i = 0; i < 8; i++) { await fxWait(90); rg.o.amp *= 0.78; }   // тряска затухает
      await fxWait(500);
    },

    // 2. НИКОГДА: стена из слова собирается ударами, одна строка вспыхивает, стена вылетает
    async never(L, C) {
      L.style.setProperty('--bar', '9vh');
      const rg = rig(L, { amp: 3, push: 0.025, beat: 760 });
      C.classList.add('is-wall');
      const rows = [];
      for (let i = 0; i < 7; i++) {
        const r = document.createElement('div');
        r.className = 'fx__wallrow';
        r.style.setProperty('--dir', i % 2 ? 1 : -1);
        r.textContent = 'НИКОГДА '.repeat(6);
        C.append(r);
        rows.push(r);
      }
      for (const r of rows) { r.classList.add('is-in'); await fxWait(130); }
      await fxWait(250);
      rows[3].classList.add('is-hero'); C.classList.add('has-hero');
      rg.o.amp = 14; rg.o.push = 0.08;
      flash(L, 70);
      await fxWait(1100);
      rows.forEach((r) => r.classList.add('is-out'));
      await fxWait(550);
    },

    // 3. НЕ ДОСТИГНЕШЬ: бесконечный бег к слову на горизонте, пол несётся всё быстрее, «НЕ» обрушивается сверху
    async reach(L, C) {
      L.style.setProperty('--bar', '12vh');
      const rg = rig(L, { amp: 3, push: 0, beat: 620 });
      C.insertAdjacentHTML('beforeend', '<div class="fx__floor"></div><div class="fx__horizon flick">ДОСТИГНЕШЬ</div>');
      const floor = C.querySelector('.fx__floor');
      const hz = C.querySelector('.fx__horizon');
      let pos = 0, speed = 140, last = performance.now(), run = true;
      const loop = (now) => {
        if (!run) return;
        const dt = (now - last) / 1000; last = now;
        speed *= Math.pow(1.9, dt);                       // скорость удваивается примерно за 0.75 с
        pos += speed * dt;
        floor.style.backgroundPosition = `0 ${(pos % 80).toFixed(1)}px, 0 ${(pos % 80).toFixed(1)}px`;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      await fxWait(2000);
      mkWord(C, 'НЕ', 'fx__ne');
      flash(L, 90); pulseFlare(5);
      rg.o.amp = 40;
      await fxWait(420);
      hz.classList.add('is-gone');
      await fxWait(700);
      run = false;
    },

    // 4. МОЕГО УРОВНЯ: слова бьют по очереди, линейки несутся, высота растёт до бесконечности, экран светлеет
    async level(L, C) {
      L.style.setProperty('--bar', '14vh');
      const rg = rig(L, { amp: 6, push: 0.04, beat: 520 });
      C.insertAdjacentHTML('beforeend',
        '<div class="fx__ruler fx__ruler--l"></div><div class="fx__ruler fx__ruler--r"></div>' +
        '<div class="fx__climb"><div class="fx__small">МОЕГО</div><div class="fx__word fx__word--l">УРОВНЯ</div></div>' +
        '<div class="fx__alt"></div>');
      L.classList.add('is-climb');
      const alt = C.querySelector('.fx__alt');
      let n = 10;
      const tm = setInterval(() => {
        n = Math.min(2e9, Math.ceil(n * 1.28));
        alt.textContent = `ВЫСОТА ${n.toLocaleString('ru-RU')} м`;
      }, 60);
      await fxWait(1200);
      rg.o.amp = 18; flash(L, 60);
      await fxWait(1100);
      clearInterval(tm);
      alt.textContent = 'ВЫСОТА ∞ м';
      rg.o.amp = 34; flash(L, 80);
      await fxWait(500);
    },

    // 5. Финал: пульс в темноте, линия света, дверь, божество, пауза «посмотри и позавидуй», ослепление
    async divine(L, C) {
      L.style.setProperty('--bar', '16vh');
      const rg = rig(L, { amp: 2, push: 0.015, beat: 430 });
      C.insertAdjacentHTML('beforeend',
        '<div class="fx__fig"><div class="fx__rays"></div><div class="fx__halo"></div>' +
        '<img class="fx__photo" src="img/divine.jpg" alt="">' +
        '<img class="fx__photo fx__photo--a" src="img/divine.jpg" alt="">' +
        '<img class="fx__photo fx__photo--b" src="img/divine.jpg" alt=""></div>' +
        '<div class="fx__blind"></div>');
      const fig = C.querySelector('.fx__fig');
      await fxWait(900);
      fig.classList.add('is-line');             // тонкая линия света растёт по центру
      await fxWait(450);
      fig.classList.add('is-open');             // дверь: фото раскрывается, чёрные полосы уходят
      L.classList.add('is-open');
      flash(L, 100); pulseFlare(6);
      rg.o.amp = 60; rg.o.push = 0.05;
      await fxWait(500);
      fig.classList.add('is-glory');
      rg.o.amp = 12;
      await fxWait(900);
      C.insertAdjacentHTML('beforeend', '<div class="fx__cap flick">ЭТО НЕ ТЫ.</div>');
      await fxWait(1700);
      if (!isCalm()) {                          // ослепление
        L.classList.add('is-blind');
        rg.o.amp = 30;
        await fxWait(1200);
      }
    }
  };

  async function runInterlude(name) {
    busy = true;
    timing = false;
    fxSkip = false;
    hidePortrait();
    const L = document.createElement('div');
    L.className = 'fx';
    L.style.setProperty('--fx-bg', INTERLUDE_BG[name] || '#000');
    L.setAttribute('aria-hidden', 'true');
    L.innerHTML = '<div class="fx__cam"></div><div class="fx__vig"></div>' +
                  '<div class="fx__bar fx__bar--t"></div><div class="fx__bar fx__bar--b"></div>';
    document.body.append(L);
    // нажатие, которое запустило переход, не считается пропуском: берём только события новее старта
    const startedAt = performance.now();
    const skip = (e) => { if (e.timeStamp > startedAt && !e.repeat) fxSkip = true; };
    L.addEventListener('pointerdown', skip);
    document.addEventListener('keydown', skip);

    await FX[name](L, L.querySelector('.fx__cam'));

    if (L._rig) L._rig.stop();
    L.innerHTML = '';                         // жёсткий обрыв в чёрное
    L.className = 'fx';
    L.style.cssText = '--fx-bg:#000';
    await sleep(name === 'divine' ? 300 : 120);
    L.remove();
    document.removeEventListener('keydown', skip);
    busy = false;
  }

  /* ==================== ДАВЛЕНИЕ ==================== */
  const nicheFor = (h) => (h > 0 ? NICHES[Math.min(h, NICHES.length) - 1] : '');

  function updateStatus() {
    const n = nicheFor(hesitations);
    el.status.textContent = n ? `категория: ${n}` : 'категория: наблюдаем';
    retrigger(el.status, 'flick');
  }

  function onHesitate() {
    el.press.textContent = PRESS[Math.min(hesitations, PRESS.length) - 1];
    retrigger(el.press, 'flick');
    updateStatus();
    const reg = document.querySelector('.reg');   // короткая дрожь страницы
    reg.classList.remove('quake');
    void reg.offsetWidth;
    reg.classList.add('quake');
  }

  function pressTick() {
    if (!timing) return;
    const sec = (performance.now() - qStart) / 1000;
    const left = LIMIT - sec;
    if (sec < 0) { el.clock.textContent = `осталось ${pad(LIMIT)} сек`; return; }
    el.clock.textContent = left > 0
      ? `осталось ${pad(Math.ceil(left))} сек`
      : `просрочено +${pad(Math.floor(-left))} сек`;
    el.clock.classList.toggle('jitter', left <= 5);
    const overs = Math.floor(sec / LIMIT);        // 15 с = 1, 30 с = 2…
    if (overs > qOver) {
      hesitations += overs - qOver;
      qOver = overs;
      onHesitate();
    }
  }

  /* ==================== «ОБРАБОТКА» И ВЕРДИКТ ==================== */
  const isCalm = () => document.documentElement.classList.contains('calm');

  function computeVerdict() {
    const longMaiden = answers.maiden.length > 9;
    let v = answers.level - 1;
    if (longMaiden) v -= 1;
    return { v: Math.max(0, v), longMaiden };
  }

  // Путь полоски (доли 0..1). Она летит к высоким уровням, «передумывает»
  // и падает назад на вердикт T: середина ячейки вердикта.
  function makePts(T) {
    const up = Math.min(0.97, T + 0.22);
    return [[0, 0], [800, 0.08], [1400, 0.08], [2600, up * 0.6], [3000, up * 0.6],
            [4300, up], [SCAN_DROP, up], [5100, T], [5500, T + 0.012], [5900, T],
            [8300, T], [SCAN_END, T]];
  }

  function progressAt(pts, t) {
    for (let i = 1; i < pts.length; i++) {
      const [t1, p1] = pts[i];
      if (t <= t1) {
        const [t0, p0] = pts[i - 1];
        return p0 + (p1 - p0) * ((t - t0) / (t1 - t0));
      }
    }
    return pts[pts.length - 1][1];
  }

  function buildMeter() {
    const N = LEVELS.length;
    el.meter.style.setProperty('--n', N);
    [el.stripDim, el.stripLit].forEach((strip) => {
      strip.replaceChildren(...LEVELS.map((lv) => {
        const cell = document.createElement('div');
        cell.className = 'meter__cell';
        const im = new Image();
        im.alt = '';
        im.src = imgSrc(lv);
        cell.append(im);
        return cell;
      }));
    });
    el.ticks.replaceChildren(...LEVELS.map((lv) => {
      const s = document.createElement('span');
      s.textContent = lv;
      return s;
    }));
  }

  function scanPhase() {
    timing = false;
    el.clock.textContent = '';
    el.clock.classList.remove('jitter');
    hidePortrait();
    el.ask.hidden = true;
    el.ghost.hidden = true;
    el.scan.hidden = false;
    el.counter.textContent = 'обработка данных';
    buildMeter();

    const N = LEVELS.length;
    const { v, longMaiden } = computeVerdict();
    const T = (v + 0.5) / N;
    const pts = makePts(T);

    // текст постоянно дёргается: короткие случайные сдвиги, на «падении» сильнее
    let t = 0;
    const shaker = setInterval(() => {
      if (isCalm()) return;
      const k = t > SCAN_DROP && t < SCAN_DROP + 700 ? 3 : 1;
      const dx = (Math.random() - 0.5) * 10 * k;
      const dy = (Math.random() - 0.5) * 4 * k;
      el.msg.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    }, 90);

    const t0 = performance.now();
    let lastIdx = -1;
    let lastMsg = '';
    let dropped = false;

    const tick = (now) => {
      t = now - t0;
      let p = progressAt(pts, t);
      if (t > 5900 && t < SCAN_END) p += (Math.random() - 0.5) * 0.012; // полоска дрожит перед вердиктом
      p = Math.max(0, Math.min(1, p));
      el.meter.style.setProperty('--p', p.toFixed(4));

      const idx = Math.min(N - 1, Math.floor(p * N));
      if (idx !== lastIdx) { lastIdx = idx; el.read.textContent = LEVELS[idx]; }

      if (!dropped && t >= SCAN_DROP) {          // момент падения: тряска и вспышка
        dropped = true;
        el.meter.classList.add('is-drop');
        flare.className = 'flare';
        void flare.offsetWidth;
        flare.classList.add('is-5');
        setTimeout(() => el.meter.classList.remove('is-drop'), 450);
      }

      const msg = SCAN_MSGS.filter(([from]) => t >= from).pop()[1];
      if (msg !== lastMsg) {
        lastMsg = msg;
        el.msg.textContent = msg;
        retrigger(el.msg, 'flick');
      }

      if (t < SCAN_END) requestAnimationFrame(tick);
      else { clearInterval(shaker); el.msg.style.transform = ''; showVerdict(v, longMaiden); }
    };
    requestAnimationFrame(tick);
  }

  function showVerdict(v, longMaiden) {
    const picked = answers.level;

    // данные пригодятся следующим страницам
    const niche = nicheFor(hesitations);
    try {
      localStorage.setItem('profile', JSON.stringify({ ...answers, levelName: LEVELS[picked], verdict: LEVELS[v], tier: v, niche, hesitations }));
      localStorage.setItem('fate_sec', '0');   // счётчик времени на сайте для fate.js
    } catch (e) { /* ок */ }

    let note = NOTES[v];
    if (longMaiden && picked > 0) note += ' Девичья фамилия матери слишком длинная: минус ещё одна ступень.';

    el.vPre.textContent = picked === v
      ? `${answers.name}, ты указал: ${LEVELS[picked]}. Система согласна. Впервые.`
      : `${answers.name}, ты указал: ${LEVELS[picked]}. Система не согласна.`;
    el.vLvl.textContent = LEVELS[v];
    el.vLvl.dataset.text = LEVELS[v];
    el.vNote.textContent = note;
    el.vNiche.textContent = niche
      ? `Дополнительная категория: ${niche}. За то, что не уверен в своих ответах.`
      : 'Колебаний не зафиксировано. Подозрительно.';

    // шкала застывает: горит только портрет вердикта
    el.meter.classList.add('is-final');
    el.stripLit.children[v].classList.add('is-hit');

    el.work.hidden = true;
    sleep(450).then(() => {
      el.verdict.hidden = false;
      el.counter.textContent = 'вердикт вынесен';
      retrigger(el.verdict, 'flick');
      el.vLvl.classList.add('is-glitch');
      setTimeout(() => el.vLvl.classList.remove('is-glitch'), 1100);
    });
  }

  /* ==================== МЕЛОЧИ ==================== */
  el.formNo.textContent = 'анкета № ' + String(Math.floor(1000000 + Math.random() * 9000000));
  updateStatus();
  setInterval(pressTick, 250);

  // начинаем, когда завеса ушла
  const ready = (window.Veil && window.Veil.ready) || Promise.resolve();
  ready.then(render);
})();
// Быстрый пропуск регистрации для тестирования
document.getElementById('btnSkipReg')?.addEventListener('click', () => {
  const fakeProfile = {
    name: 'Аноним',
    surname: 'Моггер',
    levelName: 'true adam',
    verdict: 'true adam',
    tier: 6,
    niche: 'элита',
    hesitations: 0
  };
  localStorage.setItem('profile', JSON.stringify(fakeProfile));
  localStorage.setItem('fate_sec', '0');
  
  if (window.Veil && typeof window.Veil.go === 'function') {
    window.Veil.go('choose.html', { word: 'ДОПУСК', phrase: 'Пропуск активирован. Добро пожаловать наверх.' });
  } else {
    location.href = 'choose.html';
  }
});
