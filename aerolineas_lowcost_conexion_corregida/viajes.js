const apiTravel=async(url,opts= {
})=> {
    const r=await fetch(url, {
        ...opts,headers: {
            'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('alcToken')||''),...(opts.headers|| {
            })
        }
    });
    const d=await r.json().catch(()=>( {
    }));
    if(!r.ok)throw new Error(d.error||'Ocurrió un error');
    return d
};
const escT=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const moneyT=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD'}).format(Number(n||0));const dateT=s=>s?new Date(String(s).replace(' ','T')).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}):'—';
document.addEventListener('DOMContentLoaded',async()=>{const token=localStorage.getItem('alcToken');if(!token){location.href='login.html';return}document.getElementById('user-name').textContent='Hola, '+(localStorage.getItem('alcName')||'Pasajero');document.getElementById('btn-logout').onclick=async()=>{try{await apiTravel('/api/logout',{method:'POST'})}catch{}localStorage.removeItem('alcToken');localStorage.removeItem('alcName');location.href='index.html'};await load();async function load(){const box=document.getElementById('viajes-list');try{const rows=await apiTravel('/api/mis-reservas');if(!rows.length){box.innerHTML='<div class="empty-panel"><div class="empty-icon">✈</div><h3>Todavía no tenés reservas</h3><p>Buscá un vuelo y comenzá a planear tu viaje.</p><br><a class="btn btn-primary" href="index.html">Buscar vuelos</a></div>';return}box.innerHTML=rows.map(r=>`<article class="reservation-card"><div><span class="pill">${escT(r.EstadoReserva)}</span><h3>${escT(r.CiudadOrigen)} (${escT(r.Origen)}) → ${escT(r.CiudadDestino)} (${escT(r.Destino)})</h3><p>Código: <strong>${escT(r.CodigoReserva)}</strong> · Asiento ${escT(r.NumeroAsiento)} · Clase ${escT(r.Clase)}</p><p>Salida: ${dateT(r.FechaHoraSalida)} · Importe: <strong>${moneyT(r.Precio)}</strong></p><p>Pago: ${escT(r.EstadoPago||'Pendiente')}</p></div><div class="reservation-actions">${r.EstadoReserva==='Pendiente de pago'?`<button class="btn btn-primary" data-pay="$ {
    r.IdReserva
}
">Pagar (demo)</button>`:''}${r.EstadoReserva!=='Cancelada'&&r.EstadoReserva!=='Completada'?`<button class="btn btn-quiet" data-bag="$ {
    r.IdReserva
}
">Agregar equipaje</button><button class="btn btn-quiet" data-check="$ {
    r.IdReserva
}
">Check-in</button><button class="btn btn-danger" data-cancel="$ {
    r.IdReserva
}
">Cancelar</button>`:''}</div></article>`).join('');box.querySelectorAll('[data-pay]').forEach(b=>b.onclick=async()=>{if(!confirm('Simular un pago aprobado para esta reserva? No se realizará un cobro real.'))return;try{const d=await apiTravel('/api/pagos',{method:'POST',body:JSON.stringify({IdReserva:Number(b.dataset.pay),Metodo:'Tarjeta',Ultimos4:'4242'})});alert(d.mensaje+' Referencia: '+d.referencia);load()}catch(e){alert(e.message)}});box.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Cancelar esta reserva?'))return;try{const d=await apiTravel('/api/reservas/'+b.dataset.cancel,{method:'DELETE'});alert(d.mensaje);load()}catch(e){alert(e.message)}});box.querySelectorAll('[data-check]').forEach(b=>b.onclick=async()=>{try{const d=await apiTravel('/api/checkin',{method:'POST',body:JSON.stringify({IdReserva:Number(b.dataset.check)})});alert(d.mensaje+' Código de embarque: '+d.CodigoEmbarque)}catch(e){alert(e.message)}});box.querySelectorAll('[data-bag]').forEach(b=>b.onclick=async()=>{const tipo=prompt('Tipo de equipaje: Cabina, Bodega o Especial','Cabina');if(!tipo)return;const peso=Number(prompt('Peso en kg','8'));const costo=Number(prompt('Costo en USD','0'));try{const d=await apiTravel('/api/equipajes',{method:'POST',body:JSON.stringify({IdReserva:Number(b.dataset.bag),Tipo,Cantidad:1,PesoKg:peso,Costo})});alert(d.mensaje+' Etiqueta: '+d.CodigoEtiqueta)}catch(e){alert(e.message)}})}catch(e){box.innerHTML='<div class="message error">'+escT(e.message)+'</div>'}}});
