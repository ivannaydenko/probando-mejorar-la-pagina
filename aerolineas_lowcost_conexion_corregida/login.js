const loginApi=async(url,opts= {
})=> {
    const r=await fetch(url, {
        ...opts,headers: {
            'Content-Type':'application/json',...(opts.headers|| {
            })
        }
    });
    const d=await r.json().catch(()=>( {
    }));
    if(!r.ok)throw new Error(d.error||'No se pudo iniciar sesión');
    return d
};
document.getElementById('login-form')?.addEventListener('submit',async e=> {
    e.preventDefault();const msg=document.getElementById('auth-message');msg.className='message';msg.textContent='Validando…';try {
        const d=await loginApi('/api/login', {
            method:'POST',body:JSON.stringify( {
                Email:document.getElementById('email').value.trim().toLowerCase(),Contrasena:document.getElementById('password').value
            })
        });localStorage.setItem('alcToken',d.token);localStorage.setItem('alcName',d.nombre);localStorage.setItem('alcEmail',d.email);localStorage.setItem('usuarioLogueado',d.nombre);const pending=sessionStorage.getItem('alcPendingFlight');if(pending) {
            sessionStorage.removeItem('alcPendingFlight');location.href='index.html?book='+encodeURIComponent(pending)
        }
        else location.href='index.html'
    }
    catch(err) {
        msg.className='message error';msg.textContent=err.message
    }
});
