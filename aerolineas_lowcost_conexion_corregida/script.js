document.addEventListener("DOMContentLoaded", () =>  {
    const usuario = localStorage.getItem("usuarioLogueado"); const userName = document.getElementById("user-name"); const btnLogin = document.getElementById("btn-login"); const btnLogout = document.getElementById("btn-logout"); if (usuario)  {
        userName.textContent = "Hola, " + usuario; btnLogin.classList.add("hidden"); btnLogout.classList.remove("hidden");
    }
    btnLogin.addEventListener("click", () =>  {
        window.location.href = "login.html";
    }); btnLogout.addEventListener("click", () =>  {
        localStorage.removeItem("usuarioLogueado"); window.location.reload();
    }); /* =========================
       CUPÓN
    ========================= */ let descuento = 0; const couponButton = document.getElementById("btn-apply-coupon"); couponButton.addEventListener("click", () =>  {
        const coupon = document .getElementById("coupon-input") .value .trim() .toUpperCase(); if (coupon === "LOWCOST20")  {
            descuento = 0.20; alert("Cupón aplicado. Tenés un 20% de descuento.");
        }
        else  {
            descuento = 0; alert("El cupón no es válido.");
        }
    }); /* =========================
       BUSCAR VUELOS
    ========================= */ const form = document.getElementById("flight-form"); form.addEventListener("submit", (event) =>  {
        event.preventDefault(); const usuarioActual = localStorage.getItem("usuarioLogueado"); if (!usuarioActual)  {
            alert("Debés iniciar sesión para reservar un vuelo."); window.location.href = "login.html"; return;
        }
        const origen = document.getElementById("origen").value.trim(); const destino = document.getElementById("destino").value.trim(); const fechaSalida = document.getElementById("fecha-salida").value; const fechaRegreso = document.getElementById("fecha-regreso").value; if (fechaRegreso && fechaRegreso < fechaSalida)  {
            alert("La fecha de regreso no puede ser anterior a la fecha de salida."); return;
        }
        mostrarVuelos( origen, destino, fechaSalida, fechaRegreso, descuento );
    });
});
/* =========================
   MOSTRAR VUELOS
========================= */ function mostrarVuelos( origen, destino, fechaSalida, fechaRegreso, descuento )  {
    const container = document.getElementById("results-container");
    container.innerHTML = "";
    const vuelos = [  {
        codigo: "ALC 245",
        salida: "08:00",
        llegada: "10:15",
        precio: 85000
    },
    {
        codigo: "ALC 318",
        salida: "13:30",
        llegada: "15:45",
        precio: 97000
    },
    {
        codigo: "ALC 421",
        salida: "19:00",
        llegada: "21:15",
        precio: 110000
    }
    ];
    vuelos.forEach(vuelo =>  {
        const precioFinal = vuelo.precio * (1 - descuento); const card = document.createElement("div"); card.className = "flight-card"; card.innerHTML = `

            <h3>Vuelo ${vuelo.codigo}</h3>

            <div class="flight-info">

                <div>
                    <div class="flight-time">
                        ${vuelo.salida} → ${vuelo.llegada}
                    </div>

                    <p>
                        ${origen} → ${destino}
                    </p>

                    <p>
                        Salida: ${formatearFecha(fechaSalida)}
                    </p>

                    ${
                        fechaRegreso
                        ? `<p>Regreso: $ {
            formatearFecha(fechaRegreso)
        }
        </p>`
                        : ""
                    }

                </div>

                <div>

                    <div class="flight-price">
                        $${precioFinal.toLocaleString("es-AR")}
                    </div>

                    <button class="btn-reservar">
                        Reservar vuelo
                    </button>

                </div>

            </div>
        `; card .querySelector(".btn-reservar") .addEventListener("click", () =>  {
            reservarVuelo( vuelo, origen, destino, fechaSalida, fechaRegreso, precioFinal );
        }); container.appendChild(card);
    });
}
/* =========================
   RESERVAR VUELO
========================= */ function reservarVuelo( vuelo, origen, destino, fechaSalida, fechaRegreso, precio )  {
    const usuario = localStorage.getItem("usuarioLogueado");
    if (!usuario)  {
        alert("Debés iniciar sesión.");
        window.location.href = "login.html";
        return;
    }
    const tarjeta = JSON.parse( localStorage.getItem(`tarjeta_${usuario}`) || "null" );
    if (!tarjeta)  {
        alert("Primero tenés que guardar una tarjeta en Mi cuenta antes de reservar.");
        window.location.href = "mi-cuenta.html";
        return;
    }
    const codigo = generarCodigoReserva();
    const asiento = generarAsiento();
    const reserva =  {
        id: Date.now(),
        codigo: codigo,
        pasajero: usuario,
        vuelo: vuelo.codigo,
        origen: origen,
        destino: destino,
        fecha: formatearFecha(fechaSalida),
        fechaSalida: fechaSalida,
        fechaRegreso: fechaRegreso,
        horaSalida: vuelo.salida,
        horaLlegada: vuelo.llegada,
        asiento: asiento,
        precio: precio,
        estado: "Reservado",
        checkin: false,
        tarjetaEmbarque: null,
        metodoPago: "Tarjeta guardada",
        tarjetaFinal: tarjeta.numero,
        tarjetaTitular: tarjeta.titular
    };
    let reservas = JSON.parse( localStorage.getItem("reservas") ) || [];
    reservas.push(reserva);
    localStorage.setItem( "reservas", JSON.stringify(reservas) );
    alert( "¡Vuelo reservado correctamente!\n\n" + "Código de reserva: " + codigo + "\nAsiento: " + asiento + "\nPago: tarjeta terminada en " + tarjeta.numero );
    window.location.href = "mis-viajes.html";
}
/* =========================
   FUNCIONES
========================= */ function generarCodigoReserva()  {
    const numero = Math.floor( 100000 + Math.random() * 900000 );
    return "ALC-" + numero;
}
function generarAsiento()  {
    const fila = Math.floor( Math.random() * 30 ) + 1;
    const letras = ["A",
    "B",
    "C",
    "D",
    "E",
    "F"];
    const letra = letras[ Math.floor( Math.random() * letras.length ) ];
    return fila + letra;
}
function formatearFecha(fecha)  {
    if (!fecha)  {
        return "";
    }
    const partes = fecha.split("-");
    return ( partes[2] + "/" + partes[1] + "/" + partes[0] );
}
