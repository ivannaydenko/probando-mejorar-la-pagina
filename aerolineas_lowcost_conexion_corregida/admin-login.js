document.getElementById('admin-login-form').addEventListener('submit',async e=> {
    e.preventDefault();const msg=document.getElementById('admin-auth-message');msg.textContent='Validando…';msg.className='message';try {
        const r=await fetch('/api/admin/login', {
            method:'POST',headers: {
                'Content-Type':'application/json'
            },body:JSON.stringify( {
                Email:document.getElementById('admin-email').value.trim().toLowerCase(),Contrasena:document.getElementById('admin-password').value
            })
        });const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo iniciar sesión');localStorage.setItem('alcAdminToken',d.token);localStorage.setItem('alcAdminName',d.nombre);localStorage.setItem('alcAdminRole',d.rol);location.href='admin.html'
    }
    catch(e) {
        msg.className='message error';msg.textContent=e.message
    }
});
