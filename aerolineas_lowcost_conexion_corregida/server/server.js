app.post('/api/checkin',auth,asyncRoute(async(req,res)=> {
    const  {
        IdReserva
    }
    =req.body; const [rows]=await pool.query(`SELECT r.IdReserva,r.NumeroAsiento,r.Estado,v.FechaHoraSalida FROM reservas r JOIN vuelos v ON v.IdVuelo=r.IdVuelo WHERE r.IdReserva=? AND r.IdPasajero=?`,[IdReserva,req.user.id]); const r=rows[0];if(!r)return res.status(404).json( {
        error:'Reserva no encontrada.'
    }); if(!['Confirmada','Completada'].includes(r.Estado))return res.status(400).json( {
        error:'Primero debés tener una reserva confirmada mediante pago.'
    }); const salida = r.FechaHoraSalida instanceof Date ? r.FechaHoraSalida : new Date(String(r.FechaHoraSalida).replace(' ','T')); const now = new Date(); if(Number.isNaN(salida.getTime())) return res.status(400).json( {
        error:'La fecha de salida de la reserva no es válida.'
    }); if(now>salida || salida-now>48*60*60*1000)return res.status(400).json( {
        error:'El check-in está disponible desde 48 horas antes del vuelo y antes de la salida.'
    }); const codigo='EMB-'+crypto.randomBytes(5).toString('hex').toUpperCase(); await pool.query("INSERT INTO checkin (IdReserva,Estado,AsientoConfirmado,CodigoEmbarque) VALUES (?,'Realizado',?,?) ON DUPLICATE KEY UPDATE Estado='Realizado',AsientoConfirmado=VALUES(AsientoConfirmado),CodigoEmbarque=VALUES(CodigoEmbarque),FechaCheckin=NOW()",[IdReserva,r.NumeroAsiento,codigo]); res.status(201).json( {
        mensaje:'Check-in realizado.',CodigoEmbarque:codigo,Asiento:r.NumeroAsiento
    });
}));
app.get('/api/checkin/:reserva',auth,asyncRoute(async(req,res)=> {
    const [rows]=await pool.query('SELECT c.* FROM checkin c JOIN reservas r ON r.IdReserva=c.IdReserva WHERE c.IdReserva=? AND r.IdPasajero=?',[req.params.reserva,req.user.id]);res.json(rows[0]||null);
}));
