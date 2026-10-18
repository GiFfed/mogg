/* ==========================================================
   feedback.js — логика кнопок обратной связи и кастомных алертов
   ========================================================== */
(() => {
  'use strict';

  const btnPsychologists = document.getElementById('btnPsychologists');
  const btnResetData = document.getElementById('btnResetData');
  const btnSupport = document.getElementById('btnSupport');
  const supportModal = document.getElementById('supportModal');
  const btnCloseSupport = document.getElementById('btnCloseSupport');
  
  // Элемент для кастомного уведомления вместо alert
  const customAlert = document.getElementById('customAlert');
  const alertText = document.getElementById('alertText');
  const alertClose = document.getElementById('alertClose');

  function showAlert(text) {
    alertText.textContent = text;
    customAlert.hidden = false;
    customAlert.classList.add('flick'); // Используем наш эффект мигания из base.css
  }

  alertClose.addEventListener('click', () => {
    customAlert.hidden = true;
    customAlert.classList.remove('flick');
  });

  // 1. «Неправильно определили» — показываем стилизованное уведомление
  btnPsychologists.addEventListener('click', () => {
    showAlert('Консилиум психологов-моггеров временно недоступен. Иди умывайся холодной водой.');
  });

  // 2. «Неправильно ввёл данные» — очищаем localStorage и возвращаем на регистрацию
btnResetData.addEventListener('click', () => {
    // Создаем суровое окно подтверждения прямо на странице
    const confirmBox = document.createElement('div');
    confirmBox.className = 'custom-alert';
    confirmBox.innerHTML = `
      <div class="custom-alert__content">
        <p>Стереть текущий профиль, обнулить скулы и пройти унижение регистрации заново?</p>
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
          <button class="btn" id="confirmYes">Да, я слаб</button>
          <button class="btn" id="confirmNo">Отмена</button>
        </div>
      </div>
    `;
    document.body.append(confirmBox);

    document.getElementById('confirmYes').addEventListener('click', () => {
      localStorage.removeItem('profile');
      localStorage.removeItem('fate_sec');
      if (window.Veil && typeof window.Veil.go === 'function') {
        window.Veil.go('index.html', { word: 'СБРОС', phrase: 'Очищаем память предков…' });
      } else {
        location.href = 'index.html';
      }
    });

    document.getElementById('confirmNo').addEventListener('click', () => {
      confirmBox.remove();
    });
  });;

  // 3. «Психологическая поддержка» — показываем плашку «поплачь»
  btnSupport.addEventListener('click', () => {
    supportModal.hidden = false;
  });

  btnCloseSupport.addEventListener('click', () => {
    supportModal.hidden = true;
  });
})();