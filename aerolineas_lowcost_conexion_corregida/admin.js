const adminToken=()=>localStorage.getItem('alcAdminToken')||'';
const adminRole=()=>localStorage.getItem('alcAdminRole')||'';
const escA=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const dateA=s=>s?String(s).replace('T',' ').slice(0,16):'';const moneyA=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(Number(n||0));
async function adminApi(url,opts={}){const r=await fetch(url,{...opts,headers:{'Content-Type':'application/json',Authorization:'Bearer '+adminToken(),...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Error de administración');return d}
document.addEventListener('DOMContentLoaded',async()=>{if(!adminToken()){location.href='admin-login.html';return}document.getElementById('admin-greeting').textContent=(localStorage.getItem('alcAdminName')||'Usuario')+' · '+adminRole();document.getElementById('admin-logout').onclick=async()=>{try{await adminApi('/api/logout',{method:'POST'})}catch{}localStorage.removeItem('alcAdminToken');localStorage.removeItem('alcAdminName');localStorage.removeItem('alcAdminRole');location.href='admin-login.html'};document.getElementById('admin-nav').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;document.querySelectorAll('#admin-nav button').forEach(x=>x.classList.toggle('active',x===b));render(b.dataset.view)});await summary();await render('vuelos');
async function summary(){try{const s=await adminApi('/api/admin/resumen');document.getElementById('admin-stats').innerHTML=[['Pasajeros',s.pasajeros],['Vuelos activos',s.vuelos],['Reservas',s.reservas],['Recaudación demo',moneyA(s.recaudacion)]].map(([l,v])=>`<div class="stat-card"><span>${l}</span><strong>${escA(v)}</strong></div>`).join('')}catch(e){notify(e.message,true)}}
function notify(t,err=false){document.getElementById('admin-message').innerHTML=`<div class="${
    err?'message error':'toast'
}
">${escA(t)}</div>`;if(!err)setTimeout(()=>document.getElementById('admin-message').innerHTML='',3500)}
async function render(view){const box=document.getElementById('admin-view');box.innerHTML='<div class="panel">Cargando módulo…</div>';try{if(view==='vuelos')return await flights(box);if(view==='aeropuertos')return await airports(box);if(view==='aviones')return await planes(box);if(view==='usuarios')return await users(box);const map={pasajeros:['/api/admin/pasajeros',['IdPasajero','Nombre','Email','Pasaporte','Telefono','Estado']],reservas:['/api/admin/reservas',['IdReserva','CodigoReserva','Pasajero','Origen','Destino','FechaHoraSalida','NumeroAsiento','Precio','Estado']],pagos:['/api/admin/pagos',['IdPago','CodigoReserva','Importe','Metodo','Estado','ReferenciaProveedor','FechaPago']],equipajes:['/api/admin/equipajes',['IdEquipaje','CodigoReserva','Tipo','Cantidad','PesoKg','Costo','Estado','CodigoEtiqueta']],checkin:['/api/admin/checkin',['IdCheckin','CodigoReserva','Estado','FechaCheckin','AsientoConfirmado','CodigoEmbarque']]};const [url,cols]=map[view];const rows=await adminApi(url);box.innerHTML=`<div class="panel"><h2>${view[0].toUpperCase()+view.slice(1)}</h2><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${escA(r[c])}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${
    cols.length
}
">No hay registros para mostrar.</td></tr>`}</tbody></table></div></div>`}catch(e){box.innerHTML=`<div class="panel message error">${escA(e.message)}</div>`}}
async function airports(box) {
    const rows = await adminApi('/api/admin/aeropuertos');
    box.innerHTML = `
        <div class="panel">
            <h2>Registrar aeropuerto</h2>
            <form id="airport-form" class="grid-2">
                <label class="field">Código IATA
                    <input name="CodigoIATA" maxlength="3" minlength="3" required placeholder="EZE" pattern="[A-Za-z]{3}" title="Ingresá tres letras, por ejemplo EZE">
                </label>
                <label class="field">Nombre<input name="Nombre" maxlength="120" required></label>
                <label class="field">Ciudad<input name="Ciudad" maxlength="100" required></label>
                <label class="field">País<input name="Pais" maxlength="100" required></label>
                <label class="field">Zona horaria<input name="ZonaHoraria" maxlength="60" placeholder="America/Argentina/Buenos_Aires"></label>
                <div class="form-actions"><button class="btn btn-primary" type="submit">Guardar aeropuerto</button></div>
            </form>
        </div>
        <div class="panel"><h2>Aeropuertos registrados</h2>${table(rows, ['CodigoIATA', 'Nombre', 'Ciudad', 'Pais', 'Activo'])}</div>`;

    const form = box.querySelector('#airport-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form));
        data.CodigoIATA = String(data.CodigoIATA || '').trim().toUpperCase();
        for (const field of ['Nombre', 'Ciudad', 'Pais']) data[field] = String(data[field] || '').trim();
        data.ZonaHoraria = String(data.ZonaHoraria || '').trim();
        if (!/^[A-Z]{3}$/.test(data.CodigoIATA)) {
            notify('El código IATA debe tener exactamente tres letras, por ejemplo EZE.', true);
            return;
        }
        if (!data.Nombre || !data.Ciudad || !data.Pais) {
            notify('Completá nombre, ciudad y país.', true);
            return;
        }
        button.disabled = true;
        button.textContent = 'Guardando…';
        try {
            const result = await adminApi('/api/admin/aeropuertos', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            notify(result.mensaje || 'Aeropuerto creado correctamente.');
            await render('aeropuertos');
        } catch (err) {
            notify(err.message || 'No se pudo guardar el aeropuerto.', true);
            button.disabled = false;
            button.textContent = 'Guardar aeropuerto';
        }
    });
}
async function planes(box){const rows=await adminApi('/api/admin/aviones');box.innerHTML=`<div class="panel"><h2>Registrar aeronave</h2><form id="plane-form" class="grid-2"><label class="field">Matrícula<input name="Matricula" required></label><label class="field">Modelo<input name="Modelo" required></label><label class="field">Fabricante<input name="Fabricante" required></label><label class="field">Capacidad de pasajeros<input name="Capacidad" type="number" min="1" required></label><label class="field">Autonomía (km)<input name="Autonomia" type="number" min="0" value="0"></label><label class="field">Estado<select name="Estado"><option>Disponible</option><option>Mantenimiento</option><option>Fuera de servicio</option></select></label><div class="form-actions"><button class="btn btn-primary">Guardar aeronave</button></div></form></div><div class="panel"><h2>Aeronaves registradas</h2>${table(rows,['Matricula','Modelo','Fabricante','Capacidad','Autonomia','Estado'])}</div>`;box.querySelector('#plane-form').onsubmit=async e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(e.target));data.Capacidad=Number(data.Capacidad);data.Autonomia=Number(data.Autonomia);await adminApi('/api/admin/aviones',{method:'POST',body:JSON.stringify(data)});notify('Aeronave creada.');render('aviones')}catch(err){notify(err.message,true)}}}
async function flights(box) {
    const [rows, airports, planes] = await Promise.all([
        adminApi('/api/admin/vuelos'),
        adminApi('/api/admin/aeropuertos'),
        adminApi('/api/admin/aviones')
    ]);

    const airportOptions = airports
        .filter(a => Number(a.Activo) === 1)
        .map(a => `<option value="${escA(a.CodigoIATA)}">${escA(a.Ciudad)} (${escA(a.CodigoIATA)})</option>`)
        .join('');
    const planeOptions = planes
        .filter(p => !p.Estado || p.Estado === 'Disponible')
        .map(p => `<option value="${escA(p.Matricula)}">${escA(p.Matricula)} · ${escA(p.Modelo)}</option>`)
        .join('');

    box.innerHTML = `
        <div class="panel">
            <h2>Registrar vuelo</h2>
            ${!planeOptions ? '<p class="message error">No hay aeronaves disponibles. Registrá una aeronave o cambiá su estado a Disponible.</p>' : ''}
            ${airports.filter(a => Number(a.Activo) === 1).length < 2 ? '<p class="message error">Necesitás al menos dos aeropuertos activos para crear un vuelo.</p>' : ''}
            <form id="flight-admin-form" class="grid-2">
                <label class="field">Aeronave
                    <select name="Matricula" required>${planeOptions}</select>
                </label>
                <label class="field">Origen
                    <select name="Origen" required><option value="">Seleccionar origen</option>${airportOptions}</select>
                </label>
                <label class="field">Destino
                    <select name="Destino" required><option value="">Seleccionar destino</option>${airportOptions}</select>
                </label>
                <label class="field">Salida
                    <input name="FechaHoraSalida" type="datetime-local" required>
                </label>
                <label class="field">Llegada
                    <input name="FechaHoraLlegada" type="datetime-local" required>
                </label>
                <label class="field">Precio base (USD)
                    <input name="PrecioBase" type="number" min="0" step="0.01" required value="100">
                </label>
                <label class="field">Estado
                    <select name="Estado"><option>Programado</option><option>Embarcando</option><option>Demorado</option><option>En vuelo</option><option>Finalizado</option></select>
                </label>
                <div class="form-actions"><button class="btn btn-primary" type="submit" ${!planeOptions || airports.filter(a => Number(a.Activo) === 1).length < 2 ? 'disabled' : ''}>Crear vuelo</button></div>
            </form>
        </div>
        <div class="panel">
            <h2>Vuelos registrados</h2>
            <div class="table-wrap"><table><thead><tr><th>ID</th><th>Ruta</th><th>Aeronave</th><th>Salida</th><th>Llegada</th><th>Precio</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>${rows.map(v => `<tr><td>${escA(v.IdVuelo)}</td><td>${escA(v.Origen)} → ${escA(v.Destino)}</td><td>${escA(v.Matricula)} · ${escA(v.Modelo)}</td><td>${escA(dateA(v.FechaHoraSalida))}</td><td>${escA(dateA(v.FechaHoraLlegada))}</td><td>${moneyA(v.PrecioBase)}</td><td>${escA(v.Estado)}</td><td>${v.Estado !== 'Cancelado' && adminRole() === 'Administrador' ? `<button class="btn btn-danger" data-cancel-flight="${escA(v.IdVuelo)}">Cancelar</button>` : '—'}</td></tr>`).join('') || '<tr><td colspan="8">No hay vuelos.</td></tr>'}</tbody></table></div>
        </div>`;

    const form = box.querySelector('#flight-admin-form');
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        const data = Object.fromEntries(new FormData(form));
        data.Matricula = String(data.Matricula || '').trim();
        data.Origen = String(data.Origen || '').trim().toUpperCase();
        data.Destino = String(data.Destino || '').trim().toUpperCase();
        data.PrecioBase = Number(data.PrecioBase);
        // MySQL DATETIME espera "YYYY-MM-DD HH:mm:ss", no el separador "T" de datetime-local.
        data.FechaHoraSalida = String(data.FechaHoraSalida || '').replace('T', ' ') + ':00';
        data.FechaHoraLlegada = String(data.FechaHoraLlegada || '').replace('T', ' ') + ':00';
        if (!data.Matricula || !data.Origen || !data.Destino || !data.FechaHoraSalida || !data.FechaHoraLlegada) {
            notify('Completá todos los campos del vuelo.', true);
            return;
        }
        if (data.Origen === data.Destino) {
            notify('El aeropuerto de origen y destino deben ser distintos.', true);
            return;
        }
        if (!Number.isFinite(data.PrecioBase) || data.PrecioBase < 0) {
            notify('Ingresá un precio válido mayor o igual a cero.', true);
            return;
        }
        if (new Date(data.FechaHoraLlegada.replace(' ', 'T')) <= new Date(data.FechaHoraSalida.replace(' ', 'T'))) {
            notify('La llegada debe ser posterior a la salida.', true);
            return;
        }
        button.disabled = true;
        button.textContent = 'Creando…';
        try {
            const result = await adminApi('/api/admin/vuelos', { method: 'POST', body: JSON.stringify(data) });
            notify(result.mensaje || 'Vuelo creado correctamente.');
            await summary();
            await render('vuelos');
        } catch (err) {
            notify(err.message || 'No se pudo crear el vuelo.', true);
            button.disabled = false;
            button.textContent = 'Crear vuelo';
        }
    });

    box.querySelectorAll('[data-cancel-flight]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('¿Cancelar el vuelo?')) return;
            try {
                await adminApi('/api/admin/vuelos/' + button.dataset.cancelFlight, { method: 'DELETE' });
                notify('Vuelo cancelado.');
                await summary();
                await render('vuelos');
            } catch (err) {
                notify(err.message, true);
            }
        });
    });
}

async function users(box){if(adminRole()!=='Administrador'){box.innerHTML='<div class="panel">Solo un administrador puede gestionar usuarios internos.</div>';return}const rows=await adminApi('/api/admin/usuarios');box.innerHTML=`<div class="panel"><h2>Crear usuario interno</h2><form id="staff-form" class="grid-2"><label class="field">Nombre<input name="Nombre" required></label><label class="field">Correo<input name="Email" type="email" required></label><label class="field">Contraseña (mínimo 8)<input name="Contrasena" type="password" minlength="8" required></label><label class="field">Rol<select name="Rol"><option>Operador</option><option>Cajero</option><option>Administrador</option></select></label><div class="form-actions"><button class="btn btn-primary">Crear usuario</button></div></form></div><div class="panel"><h2>Usuarios internos</h2>${table(rows,['IdUsuario','Nombre','Email','Rol','Estado','FechaCreacion','UltimoAcceso'])}</div>`;box.querySelector('#staff-form').onsubmit=async e=>{e.preventDefault();try{await adminApi('/api/admin/usuarios',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});notify('Usuario interno creado.');render('usuarios')}catch(err){notify(err.message,true)}}}
function table(rows,cols){return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${escA(r[c])}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${
    cols.length
}
">Sin registros.</td></tr>`}</tbody></table></div>`}
});
