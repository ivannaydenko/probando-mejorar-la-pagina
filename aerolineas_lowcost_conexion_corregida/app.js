const API='';
const token=()=>localStorage.getItem('alcToken')||'';
async function api(url,options={}) {
    const res=await fetch(API+url, {
        ...options,headers: {
            'Content-Type':'application/json',...(token()? {
                Authorization:'Bearer '+token()
            } : {}),...(options.headers|| {})
        }
    });
    let data={};
    try {
        data=await res.json();
    }
    catch {}
    if(!res.ok)throw new Error(data.error||'No se pudo completar la operación.');
    return data;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(n||0));
const date=s=>s?new Date(String(s).replace(' ','T')).toLocaleString('es-AR',{dateStyle:'medium',timeStyle:'short'}):'—';

document.addEventListener('DOMContentLoaded',async()=>{
  const name=localStorage.getItem('alcName');const userName=document.getElementById('user-name');if(name&&userName){userName.textContent='Hola, '+name;document.getElementById('login-link')?.classList.add('hidden');document.getElementById('register-link')?.classList.add('hidden');document.getElementById('btn-logout')?.classList.remove('hidden');}
  document.getElementById('btn-logout')?.addEventListener('click',async()=>{try{await api('/api/logout',{method:'POST'})}catch{}localStorage.removeItem('alcToken');localStorage.removeItem('alcName');location.reload();});
  const origin=document.getElementById('origen'),dest=document.getElementById('destino');if(!origin||!dest)return;
  try{const airports=await api('/api/aeropuertos');for(const a of airports){const label=`${a.Ciudad} (${a.CodigoIATA})`;origin.add(new Option(label,a.CodigoIATA));dest.add(new Option(label,a.CodigoIATA));}}catch(err){console.error(err);}
  document.getElementById('swap-route').addEventListener('click',()=>{const v=origin.value;origin.value=dest.value;dest.value=v});
  document.getElementById('flight-form').addEventListener('submit',async e=>{e.preventDefault();await searchFlights()});
  const pendingBook=new URLSearchParams(location.search).get('book');if(pendingBook&&token()){history.replaceState({},'',location.pathname);setTimeout(()=>bookFlight(pendingBook),150);}

  async function searchFlights(){
   const box=document.getElementById('flight-results');
   box.innerHTML='<div class="empty-panel">Buscando vuelos disponibles…</div>';
   try{
    const p=new URLSearchParams();
    if(origin.value)p.set('origen',origin.value);
    if(dest.value)p.set('destino',dest.value);
    const salida=document.getElementById('fecha-salida').value;
    const regreso=document.getElementById('fecha-regreso')?.value || '';
    if(salida)p.set('fecha',salida);
    if(regreso)p.set('fechaRegreso',regreso);
    if(regreso && salida && regreso < salida){
     box.innerHTML='<div class="message error">La fecha de regreso no puede ser anterior a la fecha de salida.</div>';
     return;
    }

    const result=await api('/api/vuelos?'+p.toString());
    const ida=Array.isArray(result)?result:(Array.isArray(result?.ida)?result.ida:[]);
    const vuelta=Array.isArray(result)?[]:(Array.isArray(result?.vuelta)?result.vuelta:[]);

    const renderGroup=(title, flights, emptyMessage)=>{
      if(!flights.length){
        return `<section class="flight-group"><h3>${esc(title)}</h3><div class="empty-panel"><div class="empty-icon">⌕</div><h3>${esc(emptyMessage)}</h3><p>Probá otra ruta o fecha, o verificá que haya vuelos futuros cargados.</p></div></section>`;
      }
      return `<section class="flight-group"><h3>${esc(title)}</h3>${flights.map(card).join('')}</section>`;
    };

    const card=f=>`<article class="flight-card">
      <div class="flight-route">
        <div>
          <span class="airport-code">${esc(f.Origen || '')}</span>
          <strong>${esc(f.CiudadOrigen || '')}</strong>
          <small>${date(f.FechaHoraSalida)}</small>
        </div>
        <div class="route-middle">
          <span>${esc(f.Modelo || 'Vuelo')}</span>
          <div class="route-rule"></div>
          <span>${Number(f.AsientosDisponibles ?? 0)} asientos</span>
        </div>
        <div class="flight-dest">
          <span class="airport-code">${esc(f.Destino || '')}</span>
          <strong>${esc(f.CiudadDestino || '')}</strong>
          <small>${date(f.FechaHoraLlegada)}</small>
        </div>
      </div>
      <div class="flight-price">
        <span>Desde</span>
        <strong>${money(f.PrecioBase || 0)}</strong>
        <button class="btn btn-primary" data-book="${f.IdVuelo}">Reservar</button>
      </div>
    </article>`;

    if(!ida.length && !regreso){
      box.innerHTML='<div class="empty-panel"><div class="empty-icon">⌕</div><h3>No encontramos vuelos disponibles</h3><p>Probá otra ruta o fecha, o verificá que haya vuelos futuros cargados.</p></div>';
      return;
    }

    box.innerHTML = renderGroup('Vuelos de ida', ida, 'No encontramos vuelos de ida') + (regreso ? renderGroup('Vuelos de regreso', vuelta, 'No encontramos vuelos de regreso') : '');
    box.querySelectorAll('[data-book]').forEach(btn=>btn.addEventListener('click',()=>bookFlight(btn.dataset.book)));
   }catch(err){
    box.innerHTML=`<div class="message error">${esc(err.message)}. Verificá que el servidor y MySQL estén funcionando.</div>`;
   }
  }

  function message(text,type='info'){const el=document.getElementById('flight-message');if(el){el.className='message '+type;el.textContent=text}}
  async function bookFlight(id){if(!token()){sessionStorage.setItem('alcPendingFlight',id);location.href='login.html?next=booking';return}const clase=prompt('Elegí la clase: Economy, Business o Primera','Economy');if(!clase) return;const asiento = prompt('Número de asiento (opcional):','');try{const data=await api('/api/reservas',{method:'POST',body:JSON.stringify({IdVuelo:Number(id),Clase:clase,NumeroAsiento:asiento||null})});message('Reserva creada correctamente. '+(data.NumeroAsiento?`Asiento ${data.NumeroAsiento}.` : ''),'success');setTimeout(()=>location.href='mis-viajes.html',700);}catch(err){message(err.message,'error');}};
});
