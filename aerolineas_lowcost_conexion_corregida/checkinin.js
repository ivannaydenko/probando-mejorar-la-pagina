const ckApi = async (url, options = {}) => {
  const token = localStorage.getItem('alcToken') || '';
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error del servidor (${response.status}).`);
  return data;
};

const ckEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

// Parse MySQL datetime values as local time, consistent with the server's check-in window.
const ckParseDate = value => {
  if (!value) return null;
  const normalized = String(value).trim().replace('T', ' ').replace(/Z$/, '');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
};
const ckDate = value => {
  const parsed = ckParseDate(value);
  return parsed ? parsed.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
};
const CK_WINDOW_MS = 48 * 60 * 60 * 1000;
const ckWindowStatus = value => {
  const departure = ckParseDate(value);
  if (!departure) return 'No se pudo interpretar la fecha de salida.';
  const remaining = departure.getTime() - Date.now();
  if (remaining <= 0) return 'El vuelo ya salió; el check-in está cerrado.';
  if (remaining > CK_WINDOW_MS) return 'El check-in estará disponible durante las 48 horas previas a la salida.';
  return '';
};

document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('checkin-list');
  const message = document.getElementById('checkin-message');
  const token = localStorage.getItem('alcToken');
  const loginLink = document.getElementById('login-link');
  const logoutButton = document.getElementById('btn-logout');
  const userName = document.getElementById('user-name');

  if (!token) {
    if (loginLink) loginLink.classList.remove('hidden');
    list.innerHTML = '<div class="empty-panel"><h3>Iniciá sesión para ver tus reservas</h3><a class="btn btn-primary" href="login.html">Iniciar sesión</a></div>';
    return;
  }

  loginLink?.classList.add('hidden');
  logoutButton?.classList.remove('hidden');
  if (userName) userName.textContent = `Hola, ${localStorage.getItem('alcName') || 'Usuario'}`;
  logoutButton?.addEventListener('click', async () => {
    try { await ckApi('/api/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('alcToken');
    localStorage.removeItem('alcName');
    localStorage.removeItem('alcEmail');
    location.href = 'login.html';
  });

  const showMessage = (text, type = 'info') => {
    message.textContent = text;
    message.className = `message ${type}`;
  };

  async function loadReservations() {
    list.innerHTML = '<div class="empty-panel">Cargando tus reservas…</div>';
    try {
      const reservations = await ckApi('/api/mis-reservas');
      if (!Array.isArray(reservations) || reservations.length === 0) {
        list.innerHTML = '<div class="empty-panel"><div class="empty-icon">✈</div><h3>No encontramos reservas para tu cuenta</h3><p>Las reservas confirmadas de esta cuenta aparecerán aquí.</p><a class="btn btn-primary" href="index.html">Buscar vuelos</a></div>';
        return;
      }

      const confirmed = reservations.filter(reservation => ['Confirmada', 'Completada'].includes(reservation.EstadoReserva));
      const notConfirmed = reservations.filter(reservation => !['Confirmada', 'Completada', 'Cancelada'].includes(reservation.EstadoReserva));
      const cancelled = reservations.filter(reservation => reservation.EstadoReserva === 'Cancelada');

      const renderReservation = reservation => {
        const status = reservation.EstadoReserva || 'Pendiente';
        const windowMessage = ckWindowStatus(reservation.FechaHoraSalida);
        const eligible = ['Confirmada', 'Completada'].includes(status) && !windowMessage;
        const departureText = windowMessage || 'Check-in disponible ahora.';
        return `<article class="reservation-card">
          <div>
            <h3>${ckEsc(reservation.CiudadOrigen || reservation.Origen)} (${ckEsc(reservation.Origen)}) → ${ckEsc(reservation.CiudadDestino || reservation.Destino)} (${ckEsc(reservation.Destino)})</h3>
            <p><strong>Código:</strong> ${ckEsc(reservation.CodigoReserva)}</p>
            <p><strong>Salida:</strong> ${ckEsc(ckDate(reservation.FechaHoraSalida))}</p>
            <p><strong>Asiento:</strong> ${ckEsc(reservation.NumeroAsiento || '—')}</p>
            <p><strong>Estado:</strong> ${ckEsc(status)}</p>
            <p class="muted">${ckEsc(departureText)}</p>
          </div>
          <div class="reservation-actions">
            ${eligible
              ? `<button class="btn btn-primary" data-checkin="${Number(reservation.IdReserva)}">Realizar check-in</button>`
              : ''}
          </div>
        </article>`;
      };

      list.innerHTML = [
        confirmed.length ? `<h2>Reservas confirmadas</h2>${confirmed.map(renderReservation).join('')}` : '',
        notConfirmed.length ? `<h2>Reservas pendientes</h2>${notConfirmed.map(renderReservation).join('')}` : '',
        cancelled.length ? `<h2>Reservas canceladas</h2>${cancelled.map(renderReservation).join('')}` : ''
      ].filter(Boolean).join('') || '<div class="empty-panel"><h3>No hay reservas para mostrar</h3></div>';

      list.querySelectorAll('[data-checkin]').forEach(button => {
        button.addEventListener('click', async () => {
          const idReserva = Number(button.dataset.checkin);
          if (!Number.isInteger(idReserva) || idReserva <= 0) {
            showMessage('No se pudo identificar la reserva. Recargá la página e intentá de nuevo.', 'error');
            return;
          }
          button.disabled = true;
          try {
            const result = await ckApi('/api/checkin', {
              method: 'POST',
              body: JSON.stringify({ IdReserva: idReserva })
            });
            showMessage(`${result.mensaje || 'Check-in realizado.'}${result.CodigoEmbarque ? ` Código de embarque: ${result.CodigoEmbarque}.` : ''}`, 'success');
            await loadReservations();
          } catch (error) {
            showMessage(error.message, 'error');
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      list.innerHTML = `<div class="empty-panel"><h3>No se pudieron cargar las reservas</h3><p>${ckEsc(error.message)}</p><button class="btn btn-quiet" id="retry-checkin">Reintentar</button></div>`;
      document.getElementById('retry-checkin')?.addEventListener('click', loadReservations);
    }
  }

  await loadReservations();
});
