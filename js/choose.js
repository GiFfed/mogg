/* ==========================================================
   choose.js — логика фонарика, поиска фото и печати текста
   ========================================================== */
(() => {
  'use strict';

  const flashlight = document.getElementById('flashlight');
  const photos = document.querySelectorAll('.target-photo');
  const mainContent = document.getElementById('mainContent');
  const navLinks = document.getElementById('navLinks');
  const typedTextDiv = document.getElementById('typedText');

  const totalPhotos = photos.length;

  // Управление позицией фонарика за курсором
  window.addEventListener('mousemove', (e) => {
    const x = e.clientX + 'px';
    const y = e.clientY + 'px';
    flashlight.style.setProperty('--x', x);
    flashlight.style.setProperty('--y', y);
    
    // Проверка расстояния от курсора до скрытых фотографий
    photos.forEach(photo => {
      const rect = photo.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
      
      // Если «посветили» на фото — оно проявляется
      if (distance < 120) {
        photo.classList.add('found');
        checkProgress();
      }
    });
  });

  function checkProgress() {
    const foundCount = document.querySelectorAll('.target-photo.found').length;
    if (foundCount === totalPhotos && !mainContent.classList.contains('unlocked')) {
      mainContent.classList.add('unlocked');
      startTypingText();
    }
  }

  // Текст, который печатается после нахождения всех улик в переулке
  const cultureText = "Ты пробрался в этот тёмный переулок сквозь фильтры реальности. Здесь за каждым углом тебя поджидает суровая правда о фрейме, челюстях и иерархии. Пути назад нет — выбирай свой следующий шаг осознанно, если у тебя еще осталась на это воля...";
  let charIndex = 0;

  function startTypingText() {
    if (charIndex < cultureText.length) {
      typedTextDiv.textContent += cultureText.charAt(charIndex);
      charIndex++;
      setTimeout(startTypingText, 30);
    } else {
      navLinks.style.display = 'flex';
    }
  }
})();

// Функция для срыва чёрной плашки по двойному клику
function unlockSection(plate) {
  plate.style.display = 'none';
}