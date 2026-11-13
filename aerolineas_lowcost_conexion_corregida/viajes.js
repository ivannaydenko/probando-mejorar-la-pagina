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
        // Ignoramos el error ya que la sesión local debe cerrarse igual.
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
          <article class="reservation-card">
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

      box.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', async () => {
          const action = button.dataset.action;
          const id = Number(button.dataset.id);
          await handleAction(action, id);
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
      const retry = document.getElementById('retry-reservations');
      if (retry) retry.addEventListener('click', loadReservations);
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
        showMessage('Reserva cancelada.', 'success');
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
