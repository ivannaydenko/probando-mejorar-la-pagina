const apiTravel = async (url, options = {}) => {
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

const escTravel = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const moneyTravel = value => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2
}).format(Number(value || 0));
const dateTravel = value => value
  ? new Date(String(value).replace(' ', 'T')).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';
const canCheckInWindow = value => {
  const salida = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(salida.getTime())) return false;
  const now = new Date();
  return now < salida && (salida - now) <= 48 * 60 * 60 * 1000;
};

 document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alcToken');
  const box = document.getElementById('viajes-list');
  const message = document.getElementById('travel-message');
  if (!token) {
    location.href = 'login.html';
    return;
  }

  const userName = document.getElementById('user-name');
  if (userName) userName.textContent = `Hola, ${localStorage.getItem('alcName') || 'Usuario'}`;
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try { await apiTravel('/api/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('alcToken');
    localStorage.removeItem('alcName');
    localStorage.removeItem('alcEmail');
    location.href = 'login.html';
  });

  const showMessage = (text, type = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
  };

  async function loadReservations() {
    box.innerHTML = '<div class="empty-panel">Cargando tus reservas…</div>';
    try {
      const reservations = await apiTravel('/api/mis-reservas');
      if (!Array.isArray(reservations) || reservations.length === 0) {
        box.innerHTML = '<div class="empty-panel"><div class="empty-icon">✈</div><h3>Todavía no tenés reservas</h3><p>Si acabás de reservar, confirma que la reserva se haya creado y vuelve a intentarlo.</p><a class="btn btn-primary" href="index.html">Buscar vuelos</a></div>';
        return;
      }

      box.innerHTML = reservations.map(reservation => {
        const id = Number(reservation.IdReserva);
        const status = reservation.EstadoReserva || 'Pendiente';
        const canPay = status === 'Pendiente de pago' && reservation.EstadoPago !== 'Aprobado';
        const canCheckIn = ['Confirmada', 'Completada'].includes(status) && canCheckInWindow(reservation.FechaHoraSalida);
        const canManage = !['Cancelada', 'Completada'].includes(status);
        return `<article class="reservation-card">
          <div>
            <h3>${escTravel(reservation.CiudadOrigen || reservation.Origen)} (${escTravel(reservation.Origen)}) → ${escTravel(reservation.CiudadDestino || reservation.Destino)} (${escTravel(reservation.Destino)})</h3>
            <p><strong>Código:</strong> ${escTravel(reservation.CodigoReserva)}</p>
            <p><strong>Salida:</strong> ${dateTravel(reservation.FechaHoraSalida)}</p>
            <p><strong>Llegada:</strong> ${dateTravel(reservation.FechaHoraLlegada)}</p>
            <p><strong>Asiento / clase:</strong> ${escTravel(reservation.NumeroAsiento)} · ${escTravel(reservation.Clase)}</p>
            <p><strong>Precio:</strong> ${moneyTravel(reservation.Precio)}</p>
            <p><strong>Estado:</strong> ${escTravel(status)}${reservation.EstadoPago ? ` · Pago: ${escTravel(reservation.EstadoPago)}` : ''}</p>
          </div>
          <div class="reservation-actions">
            ${canPay ? `<button class="btn btn-primary" data-action="pay" data-id="${id}">Pagar (demo)</button>` : ''}
            ${canManage ? `<button class="btn btn-quiet" data-action="bag" data-id="${id}">Agregar equipaje</button>` : ''}
            ${canCheckIn ? `<button class="btn btn-quiet" data-action="checkin" data-id="${id}">Check-in</button>` : ''}
            ${canManage ? `<button class="btn btn-danger" data-action="cancel" data-id="${id}">Cancelar</button>` : ''}
          </div>
        </article>`;
      }).join('');

      box.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => handleAction(button.dataset.action, Number(button.dataset.id)));
      });
    } catch (error) {
      box.innerHTML = `<div class="empty-panel"><h3>No se pudieron cargar tus reservas</h3><p>${escTravel(error.message)}</p><button class="btn btn-quiet" id="retry-reservations">Reintentar</button></div>`;
      document.getElementById('retry-reservations')?.addEventListener('click', loadReservations);
    }
  }

  async function handleAction(action, idReserva) {
    if (!Number.isInteger(idReserva) || idReserva <= 0) {
      showMessage('El identificador de la reserva no es válido. Recargá la página e intentá de nuevo.', 'error');
      return;
    }
    try {
      if (action === 'pay') {
        if (!confirm('¿Confirmás el pago de demostración? No se realizará ningún cobro real.')) return;
        const result = await apiTravel('/api/pagos', {
          method: 'POST',
          body: JSON.stringify({ IdReserva: idReserva, Metodo: 'Tarjeta' })
        });
        showMessage(result.mensaje || 'Pago registrado.', 'success');
      } else if (action === 'cancel') {
        if (!confirm('¿Querés cancelar esta reserva?')) return;
        await apiTravel(`/api/reservas/${idReserva}`, { method: 'DELETE' });
        showMessage('Reserva cancelada.', 'success');
      } else if (action === 'bag') {
        await apiTravel('/api/equipajes', {
          method: 'POST',
          body: JSON.stringify({ IdReserva: idReserva, Tipo: 'Cabina', Cantidad: 1, PesoKg: 15, Costo: 0 })
        });
        showMessage('Equipaje agregado.', 'success');
      } else if (action === 'checkin') {
        const result = await apiTravel('/api/checkin', {
          method: 'POST',
          body: JSON.stringify({ IdReserva: idReserva })
        });
        showMessage(`${result.mensaje || 'Check-in realizado.'}${result.CodigoEmbarque ? ` Código: ${result.CodigoEmbarque}.` : ''}`, 'success');
      }
      await loadReservations();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  await loadReservations();
});
