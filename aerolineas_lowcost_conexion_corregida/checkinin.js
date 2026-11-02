const ckApi=async(url,opts= {
})=> {
    const r=await fetch(url, {
        ...opts,headers: {
            'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('alcToken')||''),...(opts.headers|| {
            })
        }
    });
    const d=await r.json().catch(()=>( {
    }));
    if(!r.ok)throw new Error(d.error||'Error');
    return d
};
const ckEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const ckDate=s=>s?new Date(String(s).replace(' ','T')).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}):'—';
document.addEventListener('DOMContentLoaded',async()=>{const t=localStorage.getItem('alcToken');if(!t){document.getElementById('checkin-list').innerHTML='<div class="empty-panel"><h3>Iniciá sesión para ver tus reservas</h3><a class="btn btn-primary" href="login.html">Iniciar sesión</a></div>';return}document.getElementById('user-name').textContent='Hola, '+(localStorage.getItem('alcName')||'Pasajero');document.getElementById('login-link').classList.add('hidden');document.getElementById('btn-logout').classList.remove('hidden');document.getElementById('btn-logout').onclick=()=>{localStorage.removeItem('alcToken');localStorage.removeItem('alcName');location.href='index.html'};const box=document.getElementById('checkin-list');try{const rows=await ckApi('/api/mis-reservas');const eligible=rows.filter(r=>r.EstadoReserva==='Confirmada'||r.EstadoReserva==='Completada');if(!eligible.length){box.innerHTML='<div class="empty-panel"><h3>No tenés reservas confirmadas</h3><p>Completá el pago de una reserva antes de hacer el check-in.</p><a class="btn btn-primary" href="mis-viajes.html">Ver mis viajes</a></div>';return}for(const r of eligible){let c=null;try{c=await ckApi('/api/checkin/'+r.IdReserva)}catch{}const card=document.createElement('article');card.className='reservation-card';card.innerHTML=`<div><span class="pill">${c?'Check-in realizado':'Pendiente de check-in'}</span><h3>${ckEsc(r.CiudadOrigen)} (${ckEsc(r.Origen)}) → ${ckEsc(r.CiudadDestino)} (${ckEsc(r.Destino)})</h3><p>Reserva ${ckEsc(r.CodigoReserva)} · Asiento ${ckEsc(r.NumeroAsiento)}</p><p>Salida: ${ckDate(r.FechaHoraSalida)}</p>${c?`<p><strong>Código de embarque: ${ckEsc(c.CodigoEmbarque)}</strong></p>`:''}</div><div class="reservation-actions">${!c?`<button class="btn btn-primary" data-checkin="$ {
    r.IdReserva
}
">Realizar check-in</button>`:''}</div>`;box.appendChild(card)}box.querySelectorAll('[data-checkin]').forEach(b=>b.onclick=async()=>{try{const d=await ckApi('/api/checkin',{method:'POST',body:JSON.stringify({IdReserva:Number(b.dataset.checkin)})});alert(`${d.mensaje}\nAsiento: ${d.Asiento}\nCódigo: ${d.CodigoEmbarque}`);location.reload()}catch(e){const m=document.getElementById('checkin-message');m.className='message error';m.textContent=e.message}})}catch(e){box.innerHTML=`<div class="message error">${ckEsc(e.message)}</div>`}});
