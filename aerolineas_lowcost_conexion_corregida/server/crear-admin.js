const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
// Cargar el .env ubicado en la carpeta principal del proyecto
require('dotenv').config( {
    path: path.join(__dirname, '..', '.env')
});
// Generar un hash seguro para la contraseña
function cifrarContrasena(contrasena)  {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto .scryptSync(contrasena, salt, 64) .toString('hex');
    return `scrypt:${salt}:${hash}`;
}
async function crearAdministrador()  {
    const argumentos = process.argv.slice(2);
    const nombre = argumentos[0];
    const email = argumentos[1];
    const contrasena = argumentos[2];
    const rol = argumentos[3] || 'Administrador';
    // Validar los datos ingresados
    if (!nombre || !email || !contrasena)  {
        throw new Error( 'Uso: node crear-admin.js "Nombre" correo@ejemplo.com "Contraseña123"' );
    }
    if (!/^\S+@\S+\.\S+$/.test(email))  {
        throw new Error('El correo electrónico no es válido.');
    }
    if (contrasena.length < 8)  {
        throw new Error( 'La contraseña debe tener al menos 8 caracteres.' );
    }
    if (!['Administrador', 'Operador', 'Cajero'].includes(rol))  {
        throw new Error( 'Rol inválido. Usá Administrador, Operador o Cajero.' );
    }
    // Leer la configuración del archivo .env
    const configuracion =  {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3307),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'aerolinealowcost'
    };
    let conexion;
    try  {
        conexion = await mysql.createConnection(configuracion);
        // Verificar si ya existe una cuenta con ese correo
        const [existentes] = await conexion.execute( 'SELECT IdUsuario FROM usuarios WHERE Email = ? LIMIT 1', [email.trim().toLowerCase()] );
        if (existentes.length > 0)  {
            throw new Error( 'Ya existe un usuario con ese correo electrónico.' );
        }
        const contrasenaHash = cifrarContrasena(contrasena);
        // Crear el usuario interno
        const [resultado] = await conexion.execute( `INSERT INTO usuarios
                (Nombre, Email, ContrasenaHash, Rol)
             VALUES (?, ?, ?, ?)`, [ nombre.trim(), email.trim().toLowerCase(), contrasenaHash, rol ] );
        console.log('\nAdministrador creado correctamente.');
        console.log('ID:', resultado.insertId);
        console.log('Nombre:', nombre.trim());
        console.log('Correo:', email.trim().toLowerCase());
        console.log('Rol:', rol);
        console.log('\nYa podés probar el inicio de sesión administrativo.');
    }
    finally  {
        if (conexion)  {
            await conexion.end();
        }
    }
}
crearAdministrador().catch((error) =>  {
    console.error('\nNo se pudo crear el usuario administrador.'); console.error('Motivo:', error.message); process.exitCode = 1;
});
