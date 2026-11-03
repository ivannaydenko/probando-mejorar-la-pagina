const checkinApi = async (url, options = {}) => {
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

const checkinEsc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const checkinDate = value => value
  ? new Date(String(value).replace(' ', 'T')).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

 document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alcToken');
  const list = document.getElementById('checkin-list');
  const message = document.getElementById('checkin-message');
  const loginLink = document.getElementById('login-link');
  const logoutButton = document.getElementById('btn-logout');
  const userName = document.getElementById('user-name');

  if (!token) {
    if (loginLink) loginLink.classList.remove('hidden');
    if (list) list.innerHTML = '<div class="empty-panel"><h3>Iniciá sesión para ver tus reservas</h3><a class="btn btn-primary" href="login.html">Iniciar sesión</a></div>';
    return;
  }

  if (loginLink) loginLink.classList.add('hidden');
  if (logoutButton) logoutButton.classList.remove('hidden');
  if (userName) userName.textContent = `Hola, ${localStorage.getItem('alcName') || 'Usuario'}`;

  logoutButton?.addEventListener('click', async () => {
    try { await checkinApi('/api/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('alcToken');
    localStorage.removeItem('alcName');
    location.href = 'login.html';
  });

  const showMessage = (text, type = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
  };

  async function loadReservations() {
    list.innerHTML = '<div class="empty-panel">Cargando tus reservas…</div>';
    try {
      const reservations = await checkinApi('/api/mis-reservas');
      if (!Array.isArray(reservations) || reservations.length === 0) {
        list.innerHTML = '<div class="empty-panel"><div class="empty-icon">✈</div><h3>No encontramos reservas para tu cuenta</h3><p>Reservá un vuelo con esta cuenta y aparecerá aquí. Si acabás de reservar, comprobá que hayas iniciado sesión con el mismo usuario.</p><a class="btn btn-primary" href="index.html">Buscar vuelos</a></div>';
        return;
      }

      const confirmed = reservations.filter(reservation => ['Confirmada', 'Completada'].includes(reservation.EstadoReserva));
      const pending = reservations.filter(reservation => !['Confirmada', 'Completada', 'Cancelada'].includes(reservation.EstadoReserva));
      const cancelled = reservations.filter(reservation => reservation.EstadoReserva === 'Cancelada');

      const renderReservation = reservation => {
        const canCheckIn = ['Confirmada', 'Completada'].includes(reservation.EstadoReserva);
        return `<article class="reservation-card">
          <div>
            <h3>${checkinEsc(reservation.CiudadOrigen || reservation.Origen)} (${checkinEsc(reservation.Origen)}) → ${checkinEsc(reservation.CiudadDestino || reservation.Destino)} (${checkinEsc(reservation.Destino)})</h3>
            <p><strong>Código:</strong> ${checkinEsc(reservation.CodigoReserva)}</p>
            <p><strong>Salida:</strong> ${checkinDate(reservation.FechaHoraSalida)}</p>
            <p><strong>Asiento:</strong> ${checkinEsc(reservation.NumeroAsiento || '—')}</p>
            <p><strong>Estado:</strong> ${checkinEsc(reservation.EstadoReserva)}</p>
          </div>
          <div class="reservation-actions">
            ${canCheckIn
              ? `<button class="btn btn-primary" data-checkin="${Number(reservation.IdReserva)}">Realizar check-in</button>`
              : `<span class="muted">${reservation.EstadoReserva === 'Cancelada' ? 'Reserva cancelada' : 'Completá el pago desde Mis viajes para habilitar el check-in.'}</span>`}
          </div>
        </article>`;
      };

      list.innerHTML = [
        confirmed.length ? `<h2>Reservas habilitadas para check-in</h2>${confirmed.map(renderReservation).join('')}` : '',
        pending.length ? `<h2>Reservas pendientes</h2>${pending.map(renderReservation).join('')}` : '',
        cancelled.length ? `<h2>Reservas canceladas</h2>${cancelled.map(renderReservation).join('')}` : ''
      ].filter(Boolean).join('') || '<div class="empty-panel"><h3>No hay reservas disponibles para check-in</h3></div>';

      list.querySelectorAll('[data-checkin]').forEach(button => {
        button.addEventListener('click', async () => {
          const idReserva = Number(button.dataset.checkin);
          if (!Number.isInteger(idReserva) || idReserva <= 0) {
            showMessage('El ID de la reserva no es válido. Recargá la página e intentá de nuevo.', 'error');
            return;
          }
          button.disabled = true;
          try {
            const result = await checkinApi('/api/checkin', {
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
      list.innerHTML = `<div class="empty-panel"><h3>No se pudieron cargar las reservas</h3><p>${checkinEsc(error.message)}</p><button class="btn btn-quiet" id="retry-checkin">Reintentar</button></div>`;
      document.getElementById('retry-checkin')?.addEventListener('click', loadReservations);
    }
  }

  await loadReservations();
});
