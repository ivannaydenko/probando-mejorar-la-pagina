document.getElementById('formulario-registro')?.addEventListener('submit',async e=> {
    e.preventDefault();const msg=document.getElementById('auth-message');msg.className='message';msg.textContent='Creando cuenta…';const body= {
        Nombre:document.getElementById('nombre').value.trim(),Pasaporte:document.getElementById('pasaporte').value.trim(),Email:document.getElementById('email').value.trim().toLowerCase(),Telefono:document.getElementById('telefono').value.trim()||null,NroViajeroFrecuente:document.getElementById('viajero_frecuente').value.trim()||null,Contrasena:document.getElementById('contrasena').value
    };try {
        const r=await fetch('/api/registro', {
            method:'POST',headers: {
                'Content-Type':'application/json'
            },body:JSON.stringify(body)
        });const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo crear la cuenta.');msg.className='message success';msg.textContent='Cuenta creada. Te llevamos al inicio de sesión…';setTimeout(()=>location.href='login.html',900)
    }
    catch(err) {
        msg.className='message error';msg.textContent=err.message
    }
});
