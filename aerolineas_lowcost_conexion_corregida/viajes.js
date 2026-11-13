const apiTravel = async (url, opts = {}) => {
  const token = localStorage.getItem('alcToken') || '';
  const response = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Ocurrió un error');
  return data;
};

const escTravel = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const moneyTravel = value => new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
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

const CANCELLED_RESERVATION_KEY = 'alcCancelledReservationAt:';
const CANCELLED_RESERVATION_DISPLAY_MS = 60 * 1000;

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alcToken');
  if (!token) {
    location.href = 'login.html';
    return;
  }

  const box = document.getElementById('viajes-list');
  const message = document.getElementById('travel-message');
  const userName = document.getElementById('user-name');
  const logoutButton = document.getElementById('btn-logout');

  if (userName) {
    userName.textContent = `Hola, ${localStorage.getItem('alcName') || 'Usuario'}`;
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      try {
        await apiTravel('/api/logout', { method: 'POST' });
      } catch (error) {
        // Cerramos también la sesión local si la petición al servidor falla.
      }
      localStorage.removeItem('alcToken');
      localStorage.removeItem('alcName');
      localStorage.removeItem('alcEmail');
      location.href = 'login.html';
    });
  }

  const showMessage = (text, type = 'info') => {
    if (!message) return;
    message.textContent = text;
    message.className = `message ${type}`;
  };

  function scheduleCancelledReservationRemoval(idReserva) {
    const storageKey = `${CANCELLED_RESERVATION_KEY}${idReserva}`;
    const cancelledAt = Number(sessionStorage.getItem(storageKey));
    if (!cancelledAt) return;

    const remaining = CANCELLED_RESERVATION_DISPLAY_MS - (Date.now() - cancelledAt);
    const removeCard = () => {
      box.querySelector(`[data-reservation-id="${idReserva}"]`)?.remove();
      sessionStorage.removeItem(storageKey);
      if (!box.querySelector('.reservation-card')) {
        box.innerHTML = `
          <div class="empty-panel">
            <div class="empty-icon">✈</div>
            <h3>No tenés reservas para mostrar</h3>
            <a class="btn btn-primary" href="index.html">Buscar vuelos</a>
          </div>
        `;
      }
    };

    if (remaining <= 0) {
      removeCard();
      return;
    }
    window.setTimeout(removeCard, remaining);
  }

  async function loadReservations() {
    if (!box) return;
    box.innerHTML = '<div class="empty-panel">Cargando tus reservas…</div>';

    try {
      const reservas = await apiTravel('/api/mis-reservas');

      if (!Array.isArray(reservas) || reservas.length === 0) {
        box.innerHTML = `
          <div class="empty-panel">
            <div class="empty-icon">✈</div>
            <h3>Todavía no tenés reservas</h3>
            <p>Si acabás de reservar, confirmá que la operación haya finalizado y volvé a intentarlo.</p>
            <a class="btn btn-primary" href="index.html">Buscar vuelos</a>
          </div>
        `;
        return;
      }

      box.innerHTML = reservas.map(reserva => {
        const id = Number(reserva.IdReserva);
        const status = reserva.EstadoReserva || 'Pendiente';
        const canPay = status === 'Pendiente de pago' && reserva.EstadoPago !== 'Aprobado';
        const canCheckIn = ['Confirmada', 'Completada'].includes(status) && canCheckInWindow(reserva.FechaHoraSalida);
        const canManage = !['Cancelada', 'Completada'].includes(status);

        return `
          <article class="reservation-card" data-reservation-id="${id}">
            <div>
              <h3>${escTravel(reserva.CiudadOrigen || reserva.Origen)} (${escTravel(reserva.Origen)}) → ${escTravel(reserva.CiudadDestino || reserva.Destino)} (${escTravel(reserva.Destino)})</h3>
              <p><strong>Código:</strong> ${escTravel(reserva.CodigoReserva)}</p>
              <p><strong>Salida:</strong> ${dateTravel(reserva.FechaHoraSalida)}</p>
              <p><strong>Llegada:</strong> ${dateTravel(reserva.FechaHoraLlegada)}</p>
              <p><strong>Asiento / clase:</strong> ${escTravel(reserva.NumeroAsiento)} · ${escTravel(reserva.Clase)}</p>
              <p><strong>Precio:</strong> ${moneyTravel(reserva.Precio)}</p>
              <p><strong>Estado:</strong> ${escTravel(status)}${reserva.EstadoPago ? ` · ${escTravel(reserva.EstadoPago)}` : ''}</p>
            </div>
            <div class="reservation-actions">
              ${canPay ? `<button class="btn btn-primary" data-action="pay" data-id="${id}">Pagar (demo)</button>` : ''}
              ${canManage ? `
                <button class="btn btn-quiet" data-action="bag" data-id="${id}">Agregar equipaje</button>
                ${canCheckIn ? `<button class="btn btn-quiet" data-action="checkin" data-id="${id}">Check-in</button>` : ''}
                <button class="btn btn-danger" data-action="cancel" data-id="${id}">Cancelar</button>
              ` : ''}
            </div>
          </article>
        `;
      }).join('');

      reservas
        .filter(reserva => reserva.EstadoReserva === 'Cancelada')
        .forEach(reserva => scheduleCancelledReservationRemoval(Number(reserva.IdReserva)));

      box.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', async () => {
          await handleAction(button.dataset.action, Number(button.dataset.id));
        });
      });
    } catch (error) {
      box.innerHTML = `
        <div class="empty-panel">
          <h3>No se pudieron cargar tus reservas</h3>
          <p>${escTravel(error.message)}</p>
          <button class="btn btn-quiet" id="retry-reservations">Reintentar</button>
        </div>
      `;
      document.getElementById('retry-reservations')?.addEventListener('click', loadReservations);
    }
  }

  async function handleAction(action, idReserva) {
    if (!Number.isInteger(idReserva) || idReserva <= 0) {
      showMessage('El identificador de la reserva no es válido.', 'error');
      return;
    }

    try {
      if (action === 'pay') {
        if (!confirm('¿Confirmás el pago de demostración para esta reserva? No se realizará ningún cobro real.')) return;

        const result = await apiTravel('/api/pagos', {
          method: 'POST',
          body: JSON.stringify({
            IdReserva: idReserva,
            Metodo: 'Tarjeta',
            Ultimos4: '4242'
          })
        });
        showMessage(result.mensaje || 'Pago registrado.', 'success');
      } else if (action === 'cancel') {
        if (!confirm('¿Querés cancelar esta reserva?')) return;

        await apiTravel(`/api/reservas/${idReserva}`, { method: 'DELETE' });
        sessionStorage.setItem(`${CANCELLED_RESERVATION_KEY}${idReserva}`, String(Date.now()));
        showMessage('Reserva cancelada. Se quitará de la lista en un minuto.', 'success');
      } else if (action === 'bag') {
        await apiTravel('/api/equipajes', {
          method: 'POST',
          body: JSON.stringify({
            IdReserva: idReserva,
            Tipo: 'Cabina',
            Cantidad: 1,
            PesoKg: 15,
            Costo: 0
          })
        });
        showMessage('Equipaje agregado.', 'success');
      } else if (action === 'checkin') {
        const result = await apiTravel('/api/checkin', {
          method: 'POST',
          body: JSON.stringify({ IdReserva: idReserva })
        });
        showMessage(`${result.mensaje || 'Check-in realizado.'}${result.CodigoEmbarque ? ` Código: ${result.CodigoEmbarque}` : ''}`, 'success');
      }

      await loadReservations();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  }

  await loadReservations();
});
