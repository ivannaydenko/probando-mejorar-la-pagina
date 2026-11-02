'use strict';
const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config( {
    path: path.join(__dirname, '..', '.env')
});
const app = express();
const PORT = Number(process.env.PORT || 3000);
app.use(cors());
app.use(express.json( {
    limit:'1mb'
}));
app.use(express.static(path.join(__dirname, '..')));
const pool = mysql.createPool( {
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'aerolinealowcost', waitForConnections:true, connectionLimit:10, queueLimit:0, dateStrings:true
});
const sessions = new Map();
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) =>  {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt:${salt}:${hash}`;
};
const verifyPassword = (password, stored) =>  {
    if (!stored) return false;
    if (!stored.startsWith('scrypt:')) return stored === password;
    // migración de cuentas de demo antiguas
    const [,
    salt,
    expected] = stored.split(':');
    const actual = crypto.scryptSync(password, salt, 64);
    const expectedBuf = Buffer.from(expected, 'hex');
    return actual.length === expectedBuf.length && crypto.timingSafeEqual(actual, expectedBuf);
};
function getToken(req) {
    return (req.headers.authorization || '').replace(/^Bearer\s+/i,'').trim();
}
function auth(req,res,next) {
    const session = sessions.get(getToken(req));
    if (!session) return res.status(401).json( {
        error:'Iniciá sesión para continuar.'
    });
    req.user = session;
    next();
}
function admin(req,res,next) {
    const session = sessions.get(getToken(req));
    if (!session || !['Administrador','Operador','Cajero'].includes(session.rol)) return res.status(403).json( {
        error:'Acceso administrativo requerido.'
    });
    req.user = session;
    next();
}
function only(...roles) {
    return (req,res,next)=> req.user && roles.includes(req.user.rol) ? next() : res.status(403).json( {
        error:'Tu rol no tiene permiso para esta operación.'
    });
}
const asyncRoute = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
app.get('/api/health', asyncRoute(async(req,res)=> {
    const [rows] = await pool.query('SELECT 1 AS ok'); res.json( {
        ok:rows[0].ok===1, servicio:'Aerolíneas Low Cost API'
    });
}));
app.get('/api/aeropuertos', asyncRoute(async(req,res)=> {
    const [rows] = await pool.query('SELECT CodigoIATA, Nombre, Ciudad, Pais FROM aeropuertos WHERE Activo=1 ORDER BY Ciudad'); res.json(rows);
}));
app.get('/api/vuelos', asyncRoute(async (req, res) => {
    const origen = String(req.query.origen || '').trim().toUpperCase();
    const destino = String(req.query.destino || '').trim().toUpperCase();
    const fechaSalida = String(req.query.fecha || '').trim();
    const fechaRegreso = String(req.query.fechaRegreso || '').trim();

    const buscarTramo = async (codigoOrigen, codigoDestino, fecha) => {
        let sql = `
            SELECT v.IdVuelo, v.Origen, ao.Ciudad AS CiudadOrigen,
                   v.Destino, ad.Ciudad AS CiudadDestino,
                   v.FechaHoraSalida, v.FechaHoraLlegada, v.Estado,
                   v.PrecioBase, a.Modelo, a.Capacidad,
                   GREATEST(a.Capacidad - (
                       SELECT COUNT(*) FROM reservas r
                       WHERE r.IdVuelo = v.IdVuelo
                         AND r.Estado NOT IN ('Cancelada', 'Rechazada')
                   ), 0) AS AsientosDisponibles
            FROM vuelos v
            INNER JOIN aviones a ON a.Matricula = v.Matricula
            INNER JOIN aeropuertos ao ON ao.CodigoIATA = v.Origen
            INNER JOIN aeropuertos ad ON ad.CodigoIATA = v.Destino
            WHERE v.Estado NOT IN ('Cancelado', 'Finalizado')
              AND v.FechaHoraSalida >= NOW()
        `;
        const params = [];
        if (codigoOrigen) { sql += ' AND v.Origen = ?'; params.push(codigoOrigen); }
        if (codigoDestino) { sql += ' AND v.Destino = ?'; params.push(codigoDestino); }
        if (fecha) { sql += ' AND DATE(v.FechaHoraSalida) = ?'; params.push(fecha); }
        sql += ' HAVING AsientosDisponibles > 0 ORDER BY v.FechaHoraSalida ASC LIMIT 100';
        const [rows] = await pool.query(sql, params);
        return rows;
    };

    const ida = await buscarTramo(origen, destino, fechaSalida);
    let vuelta = [];
    if (fechaRegreso) {
        if (origen && destino) {
            vuelta = await buscarTramo(destino, origen, fechaRegreso);
        } else {
            return res.status(400).json({ error: 'Para buscar la vuelta, seleccioná origen y destino.' });
        }
    }
    res.json({ ida, vuelta });
}));
app.post('/api/registro', asyncRoute(async(req,res)=> {
    const  {
        Pasaporte,Nombre,Email,Contrasena,Telefono,NroViajeroFrecuente
    }
    =req.body; if(!Pasaporte||!Nombre||!Email||!Contrasena) return res.status(400).json( {
        error:'Pasaporte, nombre, correo y contraseña son obligatorios.'
    }); if(!/^\S+@\S+\.\S+$/.test(Email)) return res.status(400).json( {
        error:'Ingresá un correo válido.'
    }); if(String(Contrasena).length<8) return res.status(400).json( {
        error:'La contraseña debe tener al menos 8 caracteres.'
    }); const [result]=await pool.query('INSERT INTO pasajeros (Pasaporte,Nombre,Email,Contrasena,Telefono,NroViajeroFrecuente) VALUES (?,?,?,?,?,?)',[ String(Pasaporte).trim(),String(Nombre).trim(),String(Email).trim().toLowerCase(),hashPassword(Contrasena),Telefono||null,NroViajeroFrecuente||null]); res.status(201).json( {
        mensaje:'Cuenta creada correctamente.',IdPasajero:result.insertId
    });
}));
app.post('/api/login', asyncRoute(async(req,res)=> {
    const  {
        Email,Contrasena
    }
    =req.body; if(!Email||!Contrasena) return res.status(400).json( {
        error:'Correo y contraseña son obligatorios.'
    }); const [rows]=await pool.query('SELECT IdPasajero,Nombre,Email,Contrasena,Rol,Estado FROM pasajeros WHERE Email=? LIMIT 1',[String(Email).toLowerCase()]); const p=rows[0]; if(!p||p.Estado!=='Activo'||!verifyPassword(Contrasena,p.Contrasena)) return res.status(401).json( {
        error:'Correo o contraseña incorrectos.'
    }); if(!p.Contrasena.startsWith('scrypt:')) await pool.query('UPDATE pasajeros SET Contrasena=? WHERE IdPasajero=?',[hashPassword(Contrasena),p.IdPasajero]); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token, {
        tipo:'pasajero',id:p.IdPasajero,nombre:p.Nombre,email:p.Email,rol:'Pasajero'
    }); res.json( {
        token,nombre:p.Nombre,email:p.Email,rol:'Pasajero'
    });
}));
app.post('/api/admin/login', asyncRoute(async(req,res)=> {
    const  {
        Email,Contrasena
    }
    =req.body; const [rows]=await pool.query("SELECT IdUsuario,Nombre,Email,ContrasenaHash,Rol,Estado FROM usuarios WHERE Email=? LIMIT 1",[String(Email||'').toLowerCase()]); const u=rows[0]; if(!u||u.Estado!=='Activo'||!verifyPassword(Contrasena,u.ContrasenaHash)) return res.status(401).json( {
        error:'Credenciales administrativas incorrectas.'
    }); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token, {
        tipo:'interno',id:u.IdUsuario,nombre:u.Nombre,email:u.Email,rol:u.Rol
    }); await pool.query('UPDATE usuarios SET UltimoAcceso=NOW() WHERE IdUsuario=?',[u.IdUsuario]); res.json( {
        token,nombre:u.Nombre,email:u.Email,rol:u.Rol
    });
}));
app.post('/api/logout',auth,(req,res)=> {
    sessions.delete(getToken(req));res.json( {
        mensaje:'Sesión cerrada.'
    });
});
app.get('/api/me',auth,(req,res)=>res.json(req.user));
app.get('/api/perfil',auth,asyncRoute(async(req,res)=> {
    if(req.user.tipo!=='pasajero') return res.status(403).json( {
        error:'Perfil de pasajero solamente.'
    }); const [rows]=await pool.query('SELECT IdPasajero,Pasaporte,Nombre,Email,Telefono,NroViajeroFrecuente,FechaRegistro FROM pasajeros WHERE IdPasajero=?',[req.user.id]); res.json(rows[0]|| {
    });
}));
app.put('/api/perfil',auth,asyncRoute(async(req,res)=> {
    if(req.user.tipo!=='pasajero') return res.status(403).json( {
        error:'Perfil de pasajero solamente.'
    }); const  {
        Nombre,Email,Telefono
    }
    =req.body; if(!Nombre||!Email) return res.status(400).json( {
        error:'Nombre y correo son obligatorios.'
    }); await pool.query('UPDATE pasajeros SET Nombre=?,Email=?,Telefono=? WHERE IdPasajero=?',[Nombre.trim(),Email.trim().toLowerCase(),Telefono||null,req.user.id]); req.user.nombre=Nombre.trim();req.user.email=Email.trim().toLowerCase();res.json( {
        mensaje:'Perfil actualizado.'
    });
}));
app.put('/api/perfil/password',auth,asyncRoute(async(req,res)=> {
    if(req.user.tipo!=='pasajero') return res.status(403).json( {
        error:'Perfil de pasajero solamente.'
    }); const  {
        ContrasenaActual,ContrasenaNueva
    }
    =req.body; if(!ContrasenaNueva||ContrasenaNueva.length<8) return res.status(400).json( {
        error:'La nueva contraseña debe tener al menos 8 caracteres.'
    }); const [rows]=await pool.query('SELECT Contrasena FROM pasajeros WHERE IdPasajero=?',[req.user.id]); if(!rows[0]||!verifyPassword(ContrasenaActual,rows[0].Contrasena)) return res.status(400).json( {
        error:'La contraseña actual no coincide.'
    }); await pool.query('UPDATE pasajeros SET Contrasena=? WHERE IdPasajero=?',[hashPassword(ContrasenaNueva),req.user.id]);res.json( {
        mensaje:'Contraseña actualizada.'
    });
}));
app.post('/api/reservas',auth,asyncRoute(async(req,res)=> {
    if(req.user.tipo!=='pasajero') return res.status(403).json( {
        error:'Solo un pasajero puede reservar.'
    }); const  {
        IdVuelo,Clase='Economy',NumeroAsiento
    }
    =req.body; if(!IdVuelo||!['Economy','Business','Primera'].includes(Clase)) return res.status(400).json( {
        error:'Vuelo y clase válidos son obligatorios.'
    }); const conn=await pool.getConnection(); try {
        await conn.beginTransaction(); const [[flight]]=await conn.query("SELECT v.IdVuelo,v.Estado,v.PrecioBase,a.Capacidad FROM vuelos v JOIN aviones a ON a.Matricula=v.Matricula WHERE v.IdVuelo=? FOR UPDATE",[IdVuelo]); if(!flight||['Cancelado','Finalizado'].includes(flight.Estado)) throw Object.assign(new Error('El vuelo no está disponible.'), {
            status:400
        }); const [[count]]=await conn.query("SELECT COUNT(*) AS n FROM reservas WHERE IdVuelo=? AND Estado<>'Cancelada'",[IdVuelo]); if(count.n>=flight.Capacidad) throw Object.assign(new Error('El vuelo está completo.'), {
            status:409
        }); let seat=NumeroAsiento; if(!seat) {
            const [taken]=await conn.query("SELECT NumeroAsiento FROM reservas WHERE IdVuelo=? AND Estado<>'Cancelada'",[IdVuelo]); const set=new Set(taken.map(x=>x.NumeroAsiento)); for(let row=1;row<=Math.min(flight.Capacidad,999);row++) {
                for(const letter of ['A','B','C','D','E','F']) {
                    const candidate=`${row}${letter}`;if(!set.has(candidate)) {
                        seat=candidate;break;
                    }
                }
                if(seat)break;
            }
        }
        if(!seat) throw Object.assign(new Error('No se encontró un asiento libre.'), {
            status:409
        }); const [result]=await conn.query("INSERT INTO reservas (CodigoReserva,IdPasajero,IdVuelo,NumeroAsiento,Clase,Precio,Estado) VALUES (?,?,?,?,?,?, 'Pendiente de pago')",[ 'ALC'+crypto.randomBytes(5).toString('hex').toUpperCase(),req.user.id,IdVuelo,seat,Clase,Number(flight.PrecioBase)*(Clase==='Business'?2.5:Clase==='Primera'?3:1)]); await conn.commit();res.status(201).json( {
            mensaje:'Reserva creada. Falta completar el pago.',IdReserva:result.insertId,NumeroAsiento:seat
        });
    }
    catch(e) {
        await conn.rollback();if(e.code==='ER_DUP_ENTRY')return res.status(409).json( {
            error:'Ese asiento ya está ocupado.'
        });throw e;
    }
    finally {
        conn.release();
    }
}));
app.get('/api/mis-reservas',auth,asyncRoute(async(req,res)=> {
    if(req.user.tipo!=='pasajero') return res.status(403).json( {
        error:'Solo para pasajeros.'
    }); const [rows]=await pool.query(`SELECT r.IdReserva,r.CodigoReserva,r.NumeroAsiento,r.Clase,r.Precio,r.Estado AS EstadoReserva,r.FechaReserva,
    v.IdVuelo,v.Origen,ao.Ciudad AS CiudadOrigen,v.Destino,ad.Ciudad AS CiudadDestino,v.FechaHoraSalida,v.FechaHoraLlegada,
    (SELECT p.Estado FROM pagos p WHERE p.IdReserva=r.IdReserva ORDER BY p.IdPago DESC LIMIT 1) AS EstadoPago
    FROM reservas r JOIN vuelos v ON v.IdVuelo=r.IdVuelo JOIN aeropuertos ao ON ao.CodigoIATA=v.Origen JOIN aeropuertos ad ON ad.CodigoIATA=v.Destino
    WHERE r.IdPasajero=? ORDER BY v.FechaHoraSalida DESC`,[req.user.id]);res.json(rows);
}));
app.delete('/api/reservas/:id',auth,asyncRoute(async(req,res)=> {
    const [rows]=await pool.query('SELECT IdReserva,Estado FROM reservas WHERE IdReserva=? AND IdPasajero=?',[req.params.id,req.user.id]); if(!rows.length)return res.status(404).json( {
        error:'No se encontró la reserva.'
    }); if(rows[0].Estado==='Completada')return res.status(400).json( {
        error:'No se puede cancelar una reserva completada.'
    }); await pool.query("UPDATE reservas SET Estado='Cancelada' WHERE IdReserva=?",[req.params.id]);res.json( {
        mensaje:'Reserva cancelada.'
    });
}));
app.post('/api/pagos',auth,asyncRoute(async(req,res)=> {
    const  {
        IdReserva,Metodo='Tarjeta',Ultimos4
    }
    =req.body; const [rows]=await pool.query("SELECT IdReserva,Precio,Estado FROM reservas WHERE IdReserva=? AND IdPasajero=?",[IdReserva,req.user.id]); const r=rows[0];if(!r)return res.status(404).json( {
        error:'Reserva no encontrada.'
    }); if(r.Estado==='Cancelada')return res.status(400).json( {
        error:'No se puede pagar una reserva cancelada.'
    }); if(!['Tarjeta','Transferencia','Efectivo','Otro'].includes(Metodo))return res.status(400).json( {
        error:'Método de pago inválido.'
    }); if(Ultimos4 && !/^\d{4}$/.test(Ultimos4))return res.status(400).json( {
        error:'Ingresá solo los últimos cuatro dígitos.'
    }); const ref='DEMO-'+crypto.randomBytes(6).toString('hex').toUpperCase(); await pool.query("INSERT INTO pagos (IdReserva,Importe,Metodo,Estado,ReferenciaProveedor,Ultimos4,FechaPago) VALUES (?,?,?,'Aprobado',?,?,NOW())",[IdReserva,r.Precio,Metodo,ref,Ultimos4||null]); await pool.query("UPDATE reservas SET Estado='Confirmada' WHERE IdReserva=?",[IdReserva]); res.status(201).json( {
        mensaje:'Pago de demostración aprobado. No se realizó ningún cobro real.',referencia:ref
    });
}));
app.post('/api/equipajes',auth,asyncRoute(async(req,res)=> {
    const  {
        IdReserva,Tipo='Cabina',Cantidad=1,PesoKg=0,Descripcion,Costo=0
    }
    =req.body; const [r]=await pool.query('SELECT IdReserva FROM reservas WHERE IdReserva=? AND IdPasajero=? AND Estado<>\'Cancelada\'',[IdReserva,req.user.id]); if(!r.length)return res.status(404).json( {
        error:'Reserva no encontrada.'
    }); if(!['Cabina','Bodega','Especial'].includes(Tipo)||Number(Cantidad)<1||Number(PesoKg)<0||Number(Costo)<0)return res.status(400).json( {
        error:'Revisá los datos del equipaje.'
    }); const tag='EQ-'+crypto.randomBytes(5).toString('hex').toUpperCase(); const [out]=await pool.query('INSERT INTO equipajes (IdReserva,Tipo,Cantidad,PesoKg,Descripcion,Costo,CodigoEtiqueta) VALUES (?,?,?,?,?,?,?)',[IdReserva,Tipo,Cantidad,PesoKg,Descripcion||null,Costo,tag]); res.status(201).json( {
        mensaje:'Equipaje agregado.',IdEquipaje:out.insertId,CodigoEtiqueta:tag
    });
}));
app.get('/api/equipajes/:reserva',auth,asyncRoute(async(req,res)=> {
    const [rows]=await pool.query('SELECT e.* FROM equipajes e JOIN reservas r ON r.IdReserva=e.IdReserva WHERE e.IdReserva=? AND r.IdPasajero=? ORDER BY e.IdEquipaje DESC',[req.params.reserva,req.user.id]);res.json(rows);
}));
app.post('/api/checkin',auth,asyncRoute(async(req,res)=> {
    const  {
        IdReserva
    }
    =req.body; const [rows]=await pool.query(`SELECT r.IdReserva,r.NumeroAsiento,r.Estado,v.FechaHoraSalida FROM reservas r JOIN vuelos v ON v.IdVuelo=r.IdVuelo WHERE r.IdReserva=? AND r.IdPasajero=?`,[IdReserva,req.user.id]); const r=rows[0];if(!r)return res.status(404).json( {
        error:'Reserva no encontrada.'
    }); if(!['Confirmada','Completada'].includes(r.Estado))return res.status(400).json( {
        error:'Primero debés tener una reserva confirmada mediante pago.'
    }); const salida=new Date(r.FechaHoraSalida.replace(' ','T'));const now=new Date(); if(now>salida || salida-now>48*60*60*1000)return res.status(400).json( {
        error:'El check-in está disponible desde 48 horas antes del vuelo y antes de la salida.'
    }); const codigo='EMB-'+crypto.randomBytes(5).toString('hex').toUpperCase(); await pool.query("INSERT INTO checkin (IdReserva,Estado,AsientoConfirmado,CodigoEmbarque) VALUES (?,'Realizado',?,?) ON DUPLICATE KEY UPDATE Estado='Realizado',AsientoConfirmado=VALUES(AsientoConfirmado),CodigoEmbarque=VALUES(CodigoEmbarque),FechaCheckin=NOW()",[IdReserva,r.NumeroAsiento,codigo]); res.status(201).json( {
        mensaje:'Check-in realizado.',CodigoEmbarque:codigo,Asiento:r.NumeroAsiento
    });
}));
app.get('/api/checkin/:reserva',auth,asyncRoute(async(req,res)=> {
    const [rows]=await pool.query('SELECT c.* FROM checkin c JOIN reservas r ON r.IdReserva=c.IdReserva WHERE c.IdReserva=? AND r.IdPasajero=?',[req.params.reserva,req.user.id]);res.json(rows[0]||null);
}));
// Administración: consultas y operaciones CRUD. Las mutaciones se limitan a roles internos.
app.get('/api/admin/resumen',admin,asyncRoute(async(req,res)=> {
    const queries= {
        pasajeros:'SELECT COUNT(*) n FROM pasajeros',vuelos:"SELECT COUNT(*) n FROM vuelos WHERE Estado<>'Cancelado'",reservas:"SELECT COUNT(*) n FROM reservas WHERE Estado<>'Cancelada'",recaudacion:"SELECT COALESCE(SUM(Importe),0) n FROM pagos WHERE Estado='Aprobado'"
    }; const out= {
    };for(const [k,q] of Object.entries(queries)) {
        const [r]=await pool.query(q);out[k]=r[0].n;
    }
    res.json(out);
}));
app.get('/api/admin/vuelos',admin,asyncRoute(async(req,res)=> {
    const [r]=await pool.query(`SELECT v.*,a.Modelo,a.Capacidad FROM vuelos v JOIN aviones a ON a.Matricula=v.Matricula ORDER BY FechaHoraSalida DESC`);res.json(r);
}));
app.post('/api/admin/vuelos', admin, only('Administrador', 'Operador'), asyncRoute(async (req, res) => {
    const {
        Matricula,
        Origen,
        Destino,
        FechaHoraSalida,
        FechaHoraLlegada,
        Estado = 'Programado',
        PrecioBase = 0
    } = req.body || {};

    const salida = String(FechaHoraSalida || '').trim().replace('T', ' ');
    const llegada = String(FechaHoraLlegada || '').trim().replace('T', ' ');
    const precio = Number(PrecioBase);
    const estadosPermitidos = ['Programado', 'Embarcando', 'En vuelo', 'Finalizado', 'Cancelado', 'Demorado'];

    if (!Matricula || !Origen || !Destino || !salida || !llegada) {
        return res.status(400).json({ error: 'Completá todos los datos del vuelo.' });
    }
    if (String(Origen).toUpperCase() === String(Destino).toUpperCase()) {
        return res.status(400).json({ error: 'El aeropuerto de origen y destino deben ser distintos.' });
    }
    if (!Number.isFinite(precio) || precio < 0) {
        return res.status(400).json({ error: 'El precio base debe ser un número mayor o igual a cero.' });
    }
    if (!estadosPermitidos.includes(Estado)) {
        return res.status(400).json({ error: 'El estado seleccionado no es válido.' });
    }
    const fechaSalida = new Date(salida.replace(' ', 'T'));
    const fechaLlegada = new Date(llegada.replace(' ', 'T'));
    if (Number.isNaN(fechaSalida.getTime()) || Number.isNaN(fechaLlegada.getTime()) || fechaLlegada <= fechaSalida) {
        return res.status(400).json({ error: 'La fecha y hora de llegada deben ser posteriores a la salida.' });
    }

    const [[avion]] = await pool.query(
        "SELECT Matricula FROM aviones WHERE Matricula = ? AND Estado = 'Disponible'",
        [Matricula]
    );
    if (!avion) {
        return res.status(400).json({ error: 'La aeronave no existe o no está disponible.' });
    }
    const origen = String(Origen).trim().toUpperCase();
    const destino = String(Destino).trim().toUpperCase();
    const [[aeroOrigen]] = await pool.query('SELECT CodigoIATA FROM aeropuertos WHERE CodigoIATA = ? AND Activo = 1', [origen]);
    const [[aeroDestino]] = await pool.query('SELECT CodigoIATA FROM aeropuertos WHERE CodigoIATA = ? AND Activo = 1', [destino]);
    if (!aeroOrigen || !aeroDestino) {
        return res.status(400).json({ error: 'El origen y el destino deben ser aeropuertos registrados y activos.' });
    }

    const [result] = await pool.query(
        'INSERT INTO vuelos (Matricula, Origen, Destino, FechaHoraSalida, FechaHoraLlegada, Estado, PrecioBase) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [Matricula, origen, destino, salida.length === 16 ? salida + ':00' : salida, llegada.length === 16 ? llegada + ':00' : llegada, Estado, precio]
    );
    res.status(201).json({ mensaje: 'Vuelo creado correctamente.', IdVuelo: result.insertId });
}));
app.put('/api/admin/vuelos/:id',admin,only('Administrador','Operador'),asyncRoute(async(req,res)=> {
    const  {
        Matricula,Origen,Destino,FechaHoraSalida,FechaHoraLlegada,Estado,PrecioBase
    }
    =req.body; await pool.query('UPDATE vuelos SET Matricula=?,Origen=?,Destino=?,FechaHoraSalida=?,FechaHoraLlegada=?,Estado=?,PrecioBase=? WHERE IdVuelo=?',[Matricula,Origen,Destino,FechaHoraSalida,FechaHoraLlegada,Estado,PrecioBase,req.params.id]);res.json( {
        mensaje:'Vuelo actualizado.'
    });
}));
app.delete('/api/admin/vuelos/:id',admin,only('Administrador'),asyncRoute(async(req,res)=> {
    await pool.query("UPDATE vuelos SET Estado='Cancelado' WHERE IdVuelo=?",[req.params.id]);res.json( {
        mensaje:'Vuelo cancelado (se conserva el historial).'
    });
}));
app.get('/api/admin/aeropuertos',admin,asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT * FROM aeropuertos ORDER BY Ciudad');res.json(r);
}));
app.post('/api/admin/aeropuertos', admin, only('Administrador', 'Operador'), asyncRoute(async (req, res) => {
    const CodigoIATA = String(req.body.CodigoIATA || '').trim().toUpperCase();
    const Nombre = String(req.body.Nombre || '').trim();
    const Ciudad = String(req.body.Ciudad || '').trim();
    const Pais = String(req.body.Pais || '').trim();
    const ZonaHoraria = String(req.body.ZonaHoraria || '').trim();

    if (!/^[A-Z]{3}$/.test(CodigoIATA)) {
        return res.status(400).json({ error: 'El código IATA debe tener exactamente tres letras, por ejemplo EZE.' });
    }
    if (!Nombre || !Ciudad || !Pais) {
        return res.status(400).json({ error: 'Completá el nombre, la ciudad y el país del aeropuerto.' });
    }
    if (Nombre.length > 120 || Ciudad.length > 100 || Pais.length > 100 || ZonaHoraria.length > 60) {
        return res.status(400).json({ error: 'Uno de los campos supera la longitud permitida.' });
    }

    await pool.query(
        'INSERT INTO aeropuertos (CodigoIATA, Nombre, Ciudad, Pais, ZonaHoraria) VALUES (?, ?, ?, ?, ?)',
        [CodigoIATA, Nombre, Ciudad, Pais, ZonaHoraria || null]
    );
    res.status(201).json({ mensaje: 'Aeropuerto creado correctamente.' });
}));
app.get('/api/admin/aviones',admin,asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT * FROM aviones ORDER BY Matricula');res.json(r);
}));
app.post('/api/admin/aviones',admin,only('Administrador','Operador'),asyncRoute(async(req,res)=> {
    const  {
        Matricula,Modelo,Fabricante,Capacidad,Autonomia=0,Estado='Disponible'
    }
    =req.body;await pool.query('INSERT INTO aviones (Matricula,Modelo,Fabricante,Capacidad,Autonomia,Estado) VALUES (?,?,?,?,?,?)',[Matricula,Modelo,Fabricante,Capacidad,Autonomia,Estado]);res.status(201).json( {
        mensaje:'Aeronave creada.'
    });
}));
app.get('/api/admin/pasajeros',admin,only('Administrador','Operador'),asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT IdPasajero,Pasaporte,Nombre,Email,Telefono,NroViajeroFrecuente,Estado,FechaRegistro FROM pasajeros ORDER BY IdPasajero DESC LIMIT 500');res.json(r);
}));
app.get('/api/admin/reservas',admin,asyncRoute(async(req,res)=> {
    const [r]=await pool.query(`SELECT r.IdReserva,r.CodigoReserva,r.NumeroAsiento,r.Clase,r.Precio,r.Estado,p.Nombre AS Pasajero,p.Email,v.Origen,v.Destino,v.FechaHoraSalida FROM reservas r JOIN pasajeros p ON p.IdPasajero=r.IdPasajero JOIN vuelos v ON v.IdVuelo=r.IdVuelo ORDER BY r.IdReserva DESC LIMIT 500`);res.json(r);
}));
app.get('/api/admin/pagos',admin,only('Administrador','Cajero'),asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT p.*,r.CodigoReserva FROM pagos p JOIN reservas r ON r.IdReserva=p.IdReserva ORDER BY p.IdPago DESC LIMIT 500');res.json(r);
}));
app.get('/api/admin/equipajes',admin,asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT e.*,r.CodigoReserva FROM equipajes e JOIN reservas r ON r.IdReserva=e.IdReserva ORDER BY e.IdEquipaje DESC LIMIT 500');res.json(r);
}));
app.get('/api/admin/checkin',admin,asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT c.*,r.CodigoReserva,r.IdReserva FROM checkin c JOIN reservas r ON r.IdReserva=c.IdReserva ORDER BY c.FechaCheckin DESC LIMIT 500');res.json(r);
}));
app.get('/api/admin/usuarios',admin,only('Administrador'),asyncRoute(async(req,res)=> {
    const [r]=await pool.query('SELECT IdUsuario,Nombre,Email,Rol,Estado,FechaCreacion,UltimoAcceso FROM usuarios ORDER BY IdUsuario');res.json(r);
}));
app.post('/api/admin/usuarios',admin,only('Administrador'),asyncRoute(async(req,res)=> {
    const  {
        Nombre,Email,Contrasena,Rol='Operador'
    }
    =req.body;if(!Nombre||!Email||!Contrasena||!['Administrador','Operador','Cajero'].includes(Rol))return res.status(400).json( {
        error:'Datos incompletos o rol inválido.'
    });if(Contrasena.length<8)return res.status(400).json( {
        error:'La contraseña debe tener al menos 8 caracteres.'
    });await pool.query('INSERT INTO usuarios (Nombre,Email,ContrasenaHash,Rol) VALUES (?,?,?,?)',[Nombre,Email.toLowerCase(),hashPassword(Contrasena),Rol]);res.status(201).json( {
        mensaje:'Usuario interno creado.'
    });
}));
app.use((err,req,res,next)=> {
    console.error(err); if(res.headersSent)return next(err); if(err.code==='ER_DUP_ENTRY')return res.status(409).json( {
        error:'Ya existe un registro con alguno de esos datos.'
    }); if(err.code==='ER_NO_REFERENCED_ROW_2')return res.status(400).json( {
        error:'La referencia seleccionada no existe.'
    }); res.status(err.status||500).json( {
        error:err.status?err.message:'Error interno del servidor. Revisá la consola de Node.js.'
    });
});
app.listen(PORT, async()=> {
    console.log(`Aerolíneas Low Cost listo en http://localhost:${PORT}`); try  {
        const [rows] = await pool.query('SELECT DATABASE() AS base, VERSION() AS version'); console.log(`Conexión MySQL OK. Base: ${rows[0].base}; MySQL: ${rows[0].version}`);
    }
    catch (err)  {
        console.error('ERROR DE CONEXIÓN MYSQL:', err.code || '', err.message); console.error('Revisá el archivo .env, que MySQL esté iniciado y que la base aerolinealowcost esté importada.');
    }
});
