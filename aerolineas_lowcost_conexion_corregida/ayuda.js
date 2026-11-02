document.addEventListener("DOMContentLoaded", () =>  {
    const usuario = localStorage.getItem("usuarioLogueado"); const userName = document.getElementById("user-name"); const btnLogin = document.getElementById("btn-login"); const btnLogout = document.getElementById("btn-logout"); if (usuario)  {
        userName.textContent = "Hola, " + usuario; btnLogin.classList.add("hidden"); btnLogout.classList.remove("hidden");
    }
    else  {
        userName.textContent = ""; btnLogin.classList.remove("hidden"); btnLogout.classList.add("hidden");
    }
    btnLogin.addEventListener("click", () =>  {
        window.location.href = "login.html";
    }); btnLogout.addEventListener("click", () =>  {
        localStorage.removeItem( "usuarioLogueado" ); window.location.reload();
    });
});
