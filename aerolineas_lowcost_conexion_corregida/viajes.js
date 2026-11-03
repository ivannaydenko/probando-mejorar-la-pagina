const apiTravel = async (url, opts = {}) => {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (localStorage.getItem('alcToken') || ''),
      ...(opts.headers || {})
    }
  });

  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Ocurrió un error');
  return d;
};

const escT = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const moneyT = n => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(n || 0));
const formatDate = s => s ? new Date(String(s).replace(' ', 'T')).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const stateLabel = (estado) => {
  if (estado === 'Confirmada') return 'Confirmada';
  if (estado === 'Completada') return 'Completada';
  if (estado === 'Cancelada') return 'Cancelada';
  if (estado === 'Pendiente de pago') return 'Pendiente de pago';
  return estado || 'Reservada';
};

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('alcToken');
  if (!token) {
    location.href = 'login.html';
    return;
  }

  const userName = document.getElementById('user-name');
  if (userName) {
    userName.textContent = 'Hola, ' + (localStorage.getItem('alcName') || 'Usuario');
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try { await apiTravel('/api/logout', { method: 'POST' }); } catch {}
      localStorage.removeItem('alcToken');
      localStorage.removeItem('alcName');
      location.href = 'login.html';
    });
  }

  const box = document.getElementById('viajes-list');
  const message = document.getElementById('travel-message');

  try {
    const reservas = await apiTravel('/api/mis-reservas');
    if (!Array.isArray(reservas) || !reservas.length) {
      box.innerHTML = `
        <div class="empty-state">
          <p>Todavía no tenés viajes reservados.</p>
          <a href="index.html" class="back-button">Buscar vuelos</a>
        </div>
      `;
      return;
    }

    box.innerHTML = reservas.map(r => `
      <article class="reservation-card">
        <div>
          <h3>${escT(r.CiudadOrigen || r.Origen || 'Origen')} → ${escT(r.CiudadDestino || r.Destino || 'Destino')}</h3>
          <p><strong>Vuelo:</strong> ${escT(r.CodigoReserva || r.Codigo || 'ALC')}</p>
          <p><strong>Salida:</strong> ${formatDate(r.FechaHoraSalida)}</p>
          <p><strong>Llegada:</strong> ${formatDate(r.FechaHoraLlegada)}</p>
          <p><strong>Asiento:</strong> ${escT(r.NumeroAsiento || '—')}</p>
          <p><strong>Estado:</strong> ${escT(stateLabel(r.EstadoReserva || r.Estado || 'Reservada'))}</p>
        </div>
        <div class="reservation-actions">
          <strong>${moneyT(r.Precio || 0)}</strong>
          <button class="btn btn-primary" data-pay="${r.IdReserva}">Pagar (demo)</button>
          <button class="btn btn-quiet" data-bag="${r.IdReserva}">Agregar equipaje</button>
          <button class="btn btn-quiet" data-check="${r.IdReserva}">Check-in</button>
          <button class="btn btn-danger" data-cancel="${r.IdReserva}">Cancelar</button>
        </div>
      </article>
    `).join('');

    box.querySelectorAll('[data-pay]').forEach(button => {
      button.addEventListener('click', async () => {
        const idReserva = Number(button.dataset.pay);
        if (!idReserva) {
          message.textContent = 'No hay una reserva válida para pagar.';
          message.className = 'message error';
          return;
        }
        try {
          const res = await apiTravel('/api/pagos', {
            method: 'POST',
            body: JSON.stringify({ IdReserva: idReserva, Metodo: 'Tarjeta', Ultimos4: '4242' })
          });
          message.textContent = res.mensaje || 'Pago registrado correctamente.';
          message.className = 'message success';
          setTimeout(() => location.reload(), 700);
        } catch (err) {
          message.textContent = err.message;
          message.className = 'message error';
        }
      });
    });

    box.querySelectorAll('[data-cancel]').forEach(button => {
      button.addEventListener('click', async () => {
        const idReserva = Number(button.dataset.cancel);
        if (!idReserva) return;
        if (!confirm('¿Seguro que querés cancelar esta reserva?')) return;
        try {
          await apiTravel(`/api/reservas/${idReserva}`, { method: 'DELETE' });
          location.reload();
        } catch (err) {
          message.textContent = err.message;
          message.className = 'message error';
        }
      });
    });

    box.querySelectorAll('[data-check]').forEach(button => {
      button.addEventListener('click', async () => {
        const idReserva = Number(button.dataset.check);
        if (!idReserva) return;
        try {
          const res = await apiTravel('/api/checkin', {
            method: 'POST',
            body: JSON.stringify({ IdReserva: idReserva })
          });
          message.textContent = res.mensaje || 'Check-in realizado.';
          message.className = 'message success';
          setTimeout(() => location.reload(), 700);
        } catch (err) {
          message.textContent = err.message;
          message.className = 'message error';
        }
      });
    });

    box.querySelectorAll('[data-bag]').forEach(button => {
      button.addEventListener('click', async () => {
        const idReserva = Number(button.dataset.bag);
        if (!idReserva) return;
        try {
          const res = await apiTravel('/api/equipajes', {
            method: 'POST',
            body: JSON.stringify({ IdReserva: idReserva, Tipo: 'Cabina', Cantidad: 1, PesoKg: 15, Costo: 0 })
          });
          message.textContent = res.mensaje || 'Equipaje agregado correctamente.';
          message.className = 'message success';
        } catch (err) {
          message.textContent = err.message;
          message.className = 'message error';
        }
      });
    });

  } catch (err) {
    box.innerHTML = `
      <div class="empty-state">
        <p>No se pudieron cargar tus reservas.</p>
        <p>${escT(err.message)}</p>
        <a href="index.html" class="back-button">Buscar vuelos</a>
      </div>
    `;
  }
});
