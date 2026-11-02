document.addEventListener("DOMContentLoaded", () =>  {
    const usuario = localStorage.getItem("usuarioLogueado"); const userName = document.getElementById("user-name"); const btnLogin = document.getElementById("btn-login"); const btnLogout = document.getElementById("btn-logout"); if (!usuario)  {
        alert( "Debés iniciar sesión para ver tus viajes." ); window.location.href = "login.html"; return;
    }
    userName.textContent = "Hola, " + usuario; btnLogin.classList.add("hidden"); btnLogout.classList.remove("hidden"); btnLogout.addEventListener("click", () =>  {
        localStorage.removeItem( "usuarioLogueado" ); window.location.href = "index.html";
    }); mostrarViajes();
});
function mostrarViajes()  {
    const usuario = localStorage.getItem("usuarioLogueado");
    const container = document.getElementById("viajes-list");
    let reservas = JSON.parse( localStorage.getItem("reservas") ) || [];
    let viajes = reservas.filter( reserva => reserva.pasajero === usuario );
    container.innerHTML = "";
    if (viajes.length === 0)  {
        container.innerHTML = `

            <div class="empty-state">

                <p>
                    Todavía no tenés viajes reservados.
                </p>

                <a
                    href="index.html"
                    class="back-button"
                >
                    Buscar vuelos
                </a>

            </div>

        `;
        return;
    }
    viajes.sort( (a, b) => new Date(b.fechaSalida) - new Date(a.fechaSalida) );
    viajes.forEach(viaje =>  {
        const fechaActual = obtenerFechaActual(); let estadoTexto; let estadoClase; if ( viaje.fechaSalida && viaje.fechaSalida < fechaActual )  {
            estadoTexto = "Vuelo realizado"; estadoClase = "status-realizado";
        }
        else if (viaje.checkin)  {
            estadoTexto = "Check-in realizado"; estadoClase = "status-checkin";
        }
        else  {
            estadoTexto = "Vuelo programado"; estadoClase = "status-programado";
        }
        const card = document.createElement("div"); card.className = "travel-card"; card.innerHTML = `

            <div class="travel-header">

                <div>

                    <h3>
                        Vuelo ${viaje.vuelo}
                    </h3>

                    <span
                        class="status ${estadoClase}"
                    >
                        ${estadoTexto}
                    </span>

                </div>


                <div class="travel-actions">

                    <strong>
                        ${viaje.codigo}
                    </strong>

                    <button
                        class="btn-eliminar"
                        data-codigo="${viaje.codigo}"
                    >
                        🗑️ Eliminar boleto
                    </button>

                </div>

            </div>


            <div class="travel-info">

                <p>
                    <strong>Pasajero:</strong>
                    ${viaje.pasajero}
                </p>

                <p>
                    <strong>Origen:</strong>
                    ${viaje.origen}
                </p>

                <p>
                    <strong>Destino:</strong>
                    ${viaje.destino}
                </p>

                <p>
                    <strong>Fecha de salida:</strong>
                    ${viaje.fecha}
                </p>

                ${
                    viaje.fechaRegreso
                    ?
                    ` <p> <strong>Fecha de regreso:</strong> $ {
            formatearFecha(viaje.fechaRegreso)
        }
        </p> `
                    :
                    ""
                }

                <p>
                    <strong>Horario:</strong>
                    ${viaje.horaSalida}
                    -
                    ${viaje.horaLlegada}
                </p>

                <p>
                    <strong>Asiento:</strong>
                    ${viaje.asiento}
                </p>

                <p>
                    <strong>Precio:</strong>
                    $${Number(viaje.precio).toLocaleString("es-AR")}
                </p>

                <p>
                    <strong>Pago:</strong>
                    ${viaje.metodoPago || "Tarjeta guardada"}
                    ${viaje.tarjetaFinal ? `- **** $ {
            viaje.tarjetaFinal
        }
        ` : ""}
                </p>

            </div>

        `; card .querySelector(".btn-eliminar") .addEventListener( "click", () => eliminarBoleto(viaje.codigo) ); container.appendChild(card);
    });
}
function eliminarBoleto(codigo)  {
    const usuario = localStorage.getItem("usuarioLogueado");
    const confirmar = confirm( "¿Seguro que querés eliminar este boleto?" );
    if (!confirmar)  {
        return;
    }
    let reservas = JSON.parse( localStorage.getItem("reservas") ) || [];
    reservas = reservas.filter( reserva => !( reserva.codigo === codigo && reserva.pasajero === usuario ) );
    localStorage.setItem( "reservas", JSON.stringify(reservas) );
    mostrarViajes();
}
function obtenerFechaActual()  {
    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String( ahora.getMonth() + 1 ).padStart(2, "0");
    const dia = String( ahora.getDate() ).padStart(2, "0");
    return `${año}-${mes}-${dia}`;
}
function formatearFecha(fecha)  {
    if (!fecha)  {
        return "";
    }
    const partes = fecha.split("-");
    return ( partes[2] + "/" + partes[1] + "/" + partes[0] );
}
