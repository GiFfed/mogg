/* ==========================================================
   fate.js — «судьба»: чем дольше на сайте человек низкого уровня,
   тем сильнее сайт его унижает. Читает вердикт из регистрации.

   Подключение на любой странице, кроме регистрации:
     <link rel="stylesheet" href="css/fate.css">        (после base.css)
     <script src="js/fate.js" defer></script>
     (из папки sections/ пути с ../)

   Стадии по времени, проведённому на сайте (считается только пока
   вкладка открыта, копится между страницами):
     1: редкие разрывы картинки
     2: + надписи-унижения в случайных местах
     3: всё чаще, грубее зерно

   Проверка без ожидания: открой любую страницу с ?fate=1, ?fate=2 или ?fate=3
   ========================================================== */
(() => {
  'use strict';

  /* ---------- НАСТРОЙКИ ---------- */
  const CONFIG = {
    stages: [25, 60, 120],      // секунды на сайте, с которых начинаются стадии 1, 2, 3
    lowTier: 1,                 // деградируют уровни до этого номера включительно (0 sub3, 1 sub5)
    harshNiches: ['недостойный'], // эта категория деградирует независимо от уровня
    say: [                      // {name} — имя, {level} — вердикт
      'твоё место среди тебе подобных',
      'божественный сад не рад твоему присутствию',
      '{name}, ты опять здесь?',
      'ширина скул не подтверждена',
      'предки отвернулись',
      'мимо проходит чад. не смотри',
      'сад закрыт для {level}',
      'мы пересчитали. хуже',
      'крестьянам не рекомендовано дышать громко',
      'ты — фон для чужих фотографий'
    ]
  };

  const root = document.documentElement;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const calm = () => root.classList.contains('calm');

  /* ---------- профиль и принудительная стадия для проверки ---------- */
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('profile')); } catch (e) { /* ок */ }
  const forced = +new URLSearchParams(location.search).get('fate') || 0;
  if (forced && !profile) profile = { name: 'Тест', verdict: 'sub5', tier: 1, niche: 'крестьянин' };
  if (!profile || typeof profile.tier !== 'number') return;   // не регистрировался: сайт его не трогает

  const low = forced > 0 || profile.tier <= CONFIG.lowTier || CONFIG.harshNiches.includes(profile.niche);

  /* ---------- подпись внизу слева ---------- */
  const tag = document.createElement('div');
  tag.className = 'fate-tag';
  tag.textContent = `${profile.name}: ${profile.verdict}` + (profile.niche ? ` · ${profile.niche}` : '');
  document.body.append(tag);

  if (!low) return;   // остальных только подписываем

  /* ---------- счётчик активного времени ---------- */
  let sec = +localStorage.getItem('fate_sec') || 0;
  const stage = () => {
    if (forced) return forced;
    return CONFIG.stages.filter((t) => sec >= t).length;
  };

  setInterval(() => {
    if (document.hidden) return;
    sec++;
    try { localStorage.setItem('fate_sec', sec); } catch (e) { /* ок */ }
    const st = stage();
    root.classList.remove('fate-1', 'fate-2', 'fate-3');
    if (st > 0) root.classList.add('fate-' + st);
  }, 1000);
  if (stage() > 0) root.classList.add('fate-' + stage());

  /* ---------- эффекты ---------- */
  function tear() {
    if (calm()) return;
    const box = document.createElement('div');
    box.className = 'fate-tear';
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const bar = document.createElement('i');
      bar.style.top = rnd(0, 95) + '%';
      bar.style.height = rnd(1.5, 12) + '%';
      bar.style.transform = `translateX(${rnd(-8, 8).toFixed(1)}%)`;
      box.append(bar);
    }
    document.body.append(box);
    setTimeout(() => box.remove(), 240);
  }

  let lastSay = -1;
  function say() {
    let i;
    do { i = Math.floor(Math.random() * CONFIG.say.length); } while (i === lastSay && CONFIG.say.length > 1);
    lastSay = i;
    const node = document.createElement('div');
    node.className = 'fate-say';
    node.textContent = CONFIG.say[i].replace('{name}', profile.name || 'эй').replace('{level}', profile.verdict);
    node.style.left = rnd(3, 55) + 'vw';
    node.style.top = rnd(8, 78) + 'vh';
    node.style.setProperty('--rot', rnd(-6, 6).toFixed(1) + 'deg');
    document.body.append(node);
    setTimeout(() => node.remove(), 2800);
  }

  /* на третьей стадии всё происходит вдвое чаще */
  function schedule(fn, minMs, maxMs, minStage) {
    const run = () => {
      if (stage() >= minStage) fn();
      setTimeout(run, rnd(minMs, maxMs) / (stage() >= 3 ? 2 : 1));
    };
    setTimeout(run, rnd(minMs, maxMs));
  }
  schedule(tear, 8000, 14000, 1);
  schedule(say, 9000, 14000, 2);
})();
