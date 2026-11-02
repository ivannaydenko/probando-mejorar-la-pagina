const profileApi=async(url,opts= {
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
document.addEventListener('DOMContentLoaded',async()=> {
    if(!localStorage.getItem('alcToken')) {
        location.href='login.html';return
    }
    document.getElementById('user-name').textContent='Hola, '+(localStorage.getItem('alcName')||'Pasajero');document.getElementById('btn-logout').onclick=()=> {
        localStorage.removeItem('alcToken');localStorage.removeItem('alcName');location.href='index.html'
    };try {
        const p=await profileApi('/api/perfil');document.getElementById('profile-name').value=p.Nombre||'';document.getElementById('profile-email').value=p.Email||'';document.getElementById('profile-phone').value=p.Telefono||'';document.getElementById('profile-passport').value=p.Pasaporte||''
    }
    catch(e) {
        show('profile-message',e.message,true)
    }
    document.getElementById('profile-form').onsubmit=async e=> {
        e.preventDefault();try {
            const d=await profileApi('/api/perfil', {
                method:'PUT',body:JSON.stringify( {
                    Nombre:document.getElementById('profile-name').value.trim(),Email:document.getElementById('profile-email').value.trim(),Telefono:document.getElementById('profile-phone').value.trim()
                })
            });localStorage.setItem('alcName',document.getElementById('profile-name').value.trim());show('profile-message',d.mensaje)
        }
        catch(e) {
            show('profile-message',e.message,true)
        }
    };document.getElementById('password-form').onsubmit=async e=> {
        e.preventDefault();try {
            const d=await profileApi('/api/perfil/password', {
                method:'PUT',body:JSON.stringify( {
                    ContrasenaActual:document.getElementById('old-password').value,ContrasenaNueva:document.getElementById('new-password').value
                })
            });e.target.reset();show('password-message',d.mensaje)
        }
        catch(e) {
            show('password-message',e.message,true)
        }
    };function show(id,t,err=false) {
        const e=document.getElementById(id);e.className='message '+(err?'error':'success');e.textContent=t
    }
});
