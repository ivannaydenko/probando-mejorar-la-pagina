-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1:3307
-- Tiempo de generación: 31-10-2026 a las 00:46:26
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `aerolinealowcost`
--
DROP DATABASE IF EXISTS `aerolinealowcost`;
CREATE DATABASE IF NOT EXISTS `aerolinealowcost` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `aerolinealowcost`;

DELIMITER $$
--
-- Procedimientos
--
DROP PROCEDURE IF EXISTS `buscar_vuelos`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `buscar_vuelos` (IN `p_Origen` CHAR(3), IN `p_Destino` CHAR(3), IN `p_Fecha` DATE)   BEGIN
  SELECT v.IdVuelo,v.Origen,v.Destino,v.FechaHoraSalida,v.FechaHoraLlegada,v.PrecioBase,
         a.Modelo,a.Capacidad,
         GREATEST(a.Capacidad-(SELECT COUNT(*) FROM reservas r WHERE r.IdVuelo=v.IdVuelo AND r.Estado <> 'Cancelada'),0) AS AsientosDisponibles
  FROM vuelos v JOIN aviones a ON a.Matricula=v.Matricula
  WHERE v.Estado IN ('Programado','Demorado')
    AND (p_Origen IS NULL OR v.Origen=p_Origen)
    AND (p_Destino IS NULL OR v.Destino=p_Destino)
    AND (p_Fecha IS NULL OR DATE(v.FechaHoraSalida)=p_Fecha)
  ORDER BY v.FechaHoraSalida;
END$$

DROP PROCEDURE IF EXISTS `cancelar_reserva`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `cancelar_reserva` (IN `p_IdReserva` INT, IN `p_IdPasajero` INT)   BEGIN
  UPDATE reservas SET Estado='Cancelada'
  WHERE IdReserva=p_IdReserva AND IdPasajero=p_IdPasajero AND Estado IN ('Pendiente de pago','Confirmada');
  SELECT ROW_COUNT() AS ReservasCanceladas;
END$$

DROP PROCEDURE IF EXISTS `informacion_vuelo`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `informacion_vuelo` (IN `p_IdVuelo` INT)   BEGIN
  SELECT v.IdVuelo, v.Origen, ao.Nombre AS AeropuertoOrigen, ao.Ciudad AS CiudadOrigen,
         v.Destino, ad.Nombre AS AeropuertoDestino, ad.Ciudad AS CiudadDestino,
         v.FechaHoraSalida, v.FechaHoraLlegada, v.Estado, v.PrecioBase,
         a.Matricula, a.Modelo, a.Fabricante, a.Capacidad,
         GREATEST(a.Capacidad - (SELECT COUNT(*) FROM reservas r WHERE r.IdVuelo=v.IdVuelo AND r.Estado <> 'Cancelada'),0) AS AsientosDisponibles
  FROM vuelos v JOIN aviones a ON a.Matricula=v.Matricula
  JOIN aeropuertos ao ON ao.CodigoIATA=v.Origen
  JOIN aeropuertos ad ON ad.CodigoIATA=v.Destino
  WHERE v.IdVuelo=p_IdVuelo;
END$$

DROP PROCEDURE IF EXISTS `pasajeros_frecuentes`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `pasajeros_frecuentes` ()   BEGIN
  SELECT IdPasajero, Nombre, Pasaporte, Email, NroViajeroFrecuente
  FROM pasajeros WHERE NroViajeroFrecuente IS NOT NULL ORDER BY Nombre;
END$$

DROP PROCEDURE IF EXISTS `pasajeros_por_clase`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `pasajeros_por_clase` (IN `p_Clase` VARCHAR(20))   BEGIN
  SELECT p.IdPasajero,p.Nombre,p.Pasaporte,r.IdVuelo,r.NumeroAsiento,r.Clase,r.Precio
  FROM pasajeros p JOIN reservas r ON r.IdPasajero=p.IdPasajero
  WHERE r.Clase=p_Clase AND r.Estado <> 'Cancelada' ORDER BY p.Nombre;
END$$

DROP PROCEDURE IF EXISTS `pasajeros_por_vuelo`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `pasajeros_por_vuelo` (IN `p_IdVuelo` INT)   BEGIN
  SELECT p.IdPasajero, p.Nombre, p.Pasaporte, p.Email, r.NumeroAsiento, r.Clase, r.Precio, r.Estado
  FROM pasajeros p JOIN reservas r ON r.IdPasajero=p.IdPasajero
  WHERE r.IdVuelo=p_IdVuelo AND r.Estado <> 'Cancelada'
  ORDER BY r.NumeroAsiento;
END$$

DROP PROCEDURE IF EXISTS `recaudacion_por_vuelo`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `recaudacion_por_vuelo` (IN `p_IdVuelo` INT)   BEGIN
  SELECT v.IdVuelo, v.Origen, v.Destino,
         COUNT(CASE WHEN r.Estado <> 'Cancelada' THEN r.IdReserva END) AS CantidadReservas,
         COALESCE(SUM(CASE WHEN r.Estado <> 'Cancelada' THEN r.Precio ELSE 0 END),0) AS RecaudacionTotal
  FROM vuelos v LEFT JOIN reservas r ON r.IdVuelo=v.IdVuelo
  WHERE v.IdVuelo=p_IdVuelo GROUP BY v.IdVuelo,v.Origen,v.Destino;
END$$

DROP PROCEDURE IF EXISTS `registrar_pasajero`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `registrar_pasajero` (IN `p_Pasaporte` VARCHAR(20), IN `p_Nombre` VARCHAR(100), IN `p_Email` VARCHAR(100), IN `p_Contrasena` VARCHAR(255), IN `p_Telefono` VARCHAR(20), IN `p_NroViajeroFrecuente` VARCHAR(20))   BEGIN
  INSERT INTO pasajeros (Pasaporte,Nombre,Email,Contrasena,Telefono,NroViajeroFrecuente)
  VALUES (p_Pasaporte,p_Nombre,p_Email,p_Contrasena,p_Telefono,NULLIF(p_NroViajeroFrecuente,''));
END$$

DROP PROCEDURE IF EXISTS `reservas_por_pasajero`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `reservas_por_pasajero` (IN `p_IdPasajero` INT)   BEGIN
  SELECT r.IdReserva, r.CodigoReserva, r.Estado AS EstadoReserva, p.Nombre AS Pasajero,
         v.IdVuelo, v.Origen, v.Destino, v.FechaHoraSalida, v.FechaHoraLlegada,
         r.NumeroAsiento, r.Clase, r.Precio
  FROM reservas r JOIN pasajeros p ON p.IdPasajero=r.IdPasajero
  JOIN vuelos v ON v.IdVuelo=r.IdVuelo
  WHERE r.IdPasajero=p_IdPasajero
  ORDER BY v.FechaHoraSalida;
END$$

DROP PROCEDURE IF EXISTS `tripulacion_por_vuelo`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `tripulacion_por_vuelo` (IN `p_IdVuelo` INT)   BEGIN
  SELECT v.IdVuelo, v.Origen, v.Destino, t.IdTripulante, t.Nombre, t.Rol, t.Certificacion
  FROM vuelos v JOIN asignaciontripulacion at ON at.IdVuelo=v.IdVuelo
  JOIN tripulacion t ON t.IdTripulante=at.IdTripulante
  WHERE v.IdVuelo=p_IdVuelo;
END$$

DROP PROCEDURE IF EXISTS `vuelos_por_origen`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `vuelos_por_origen` (IN `p_Origen` CHAR(3))   BEGIN
  SELECT v.IdVuelo,v.Origen,v.Destino,v.FechaHoraSalida,v.FechaHoraLlegada,v.Matricula,v.PrecioBase,v.Estado
  FROM vuelos v WHERE v.Origen=p_Origen ORDER BY v.FechaHoraSalida;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aeropuertos`
--

DROP TABLE IF EXISTS `aeropuertos`;
CREATE TABLE `aeropuertos` (
  `CodigoIATA` char(3) NOT NULL,
  `Nombre` varchar(120) NOT NULL,
  `Ciudad` varchar(100) NOT NULL,
  `Pais` varchar(100) NOT NULL,
  `ZonaHoraria` varchar(60) DEFAULT NULL,
  `Activo` tinyint(1) NOT NULL DEFAULT 1
) ;

--
-- Volcado de datos para la tabla `aeropuertos`
--

INSERT INTO `aeropuertos` (`CodigoIATA`, `Nombre`, `Ciudad`, `Pais`, `ZonaHoraria`, `Activo`) VALUES
('AEP', 'Aeroparque Jorge Newbery', 'Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires', 1),
('ARC', 'talvez', 'tu casa', 'mi cuarto', 'dhgjfghhhjjjjjjjjjjjj', 1),
('COR', 'Aeropuerto Internacional Ingeniero Aeronáutico Ambrosio Taravella', 'Córdoba', 'Argentina', 'America/Argentina/Cordoba', 1),
('EZE', 'Aeropuerto Internacional Ministro Pistarini', 'Buenos Aires', 'Argentina', 'America/Argentina/Buenos_Aires', 1),
('GRU', 'Aeropuerto Internacional de São Paulo-Guarulhos', 'São Paulo', 'Brasil', 'America/Sao_Paulo', 1),
('IGR', 'Aeropuerto Internacional Cataratas del Iguazú', 'Puerto Iguazú', 'Argentina', 'America/Argentina/Cordoba', 1),
('MAD', 'Aeropuerto Adolfo Suárez Madrid-Barajas', 'Madrid', 'España', 'Europe/Madrid', 1),
('MDZ', 'Aeropuerto Internacional Gobernador Francisco Gabrielli', 'Mendoza', 'Argentina', 'America/Argentina/Mendoza', 1),
('MIA', 'Aeropuerto Internacional de Miami', 'Miami', 'Estados Unidos', 'America/New_York', 1),
('SCL', 'Aeropuerto Internacional Arturo Merino Benítez', 'Santiago', 'Chile', 'America/Santiago', 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `asignaciontripulacion`
--

DROP TABLE IF EXISTS `asignaciontripulacion`;
CREATE TABLE `asignaciontripulacion` (
  `IdVuelo` int(11) NOT NULL,
  `IdTripulante` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `asignaciontripulacion`
--

INSERT INTO `asignaciontripulacion` (`IdVuelo`, `IdTripulante`) VALUES
(1, 1),
(1, 3),
(2, 2),
(3, 2),
(5, 5);

--
-- Disparadores `asignaciontripulacion`
--
DROP TRIGGER IF EXISTS `antes_de_asignar_tripulacion`;
DELIMITER $$
CREATE TRIGGER `antes_de_asignar_tripulacion` BEFORE INSERT ON `asignaciontripulacion` FOR EACH ROW BEGIN
  DECLARE v_salida_nuevo DATETIME;
  DECLARE v_llegada_nuevo DATETIME;
  DECLARE v_conflictos INT DEFAULT 0;
  SELECT FechaHoraSalida,FechaHoraLlegada INTO v_salida_nuevo,v_llegada_nuevo FROM vuelos WHERE IdVuelo=NEW.IdVuelo;
  SELECT COUNT(*) INTO v_conflictos
  FROM asignaciontripulacion at JOIN vuelos v ON v.IdVuelo=at.IdVuelo
  WHERE at.IdTripulante=NEW.IdTripulante
    AND v.IdVuelo <> NEW.IdVuelo
    AND v.Estado <> 'Cancelado'
    AND v_salida_nuevo < v.FechaHoraLlegada
    AND v_llegada_nuevo > v.FechaHoraSalida;
  IF v_conflictos > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El tripulante ya está asignado a otro vuelo en un horario superpuesto.';
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `aviones`
--

DROP TABLE IF EXISTS `aviones`;
CREATE TABLE `aviones` (
  `Matricula` varchar(10) NOT NULL,
  `Modelo` varchar(50) NOT NULL,
  `Fabricante` varchar(50) NOT NULL,
  `Capacidad` int(11) NOT NULL,
  `Autonomia` int(11) NOT NULL DEFAULT 0,
  `Estado` enum('Disponible','Mantenimiento','Fuera de servicio') NOT NULL DEFAULT 'Disponible'
) ;

--
-- Volcado de datos para la tabla `aviones`
--

INSERT INTO `aviones` (`Matricula`, `Modelo`, `Fabricante`, `Capacidad`, `Autonomia`, `Estado`) VALUES
('EC-MUT', 'Airbus A350-900', 'Airbus', 348, 15000, 'Disponible'),
('LV-FUA', 'Boeing 737-800', 'Boeing', 170, 5700, 'Disponible'),
('LV-GHO', 'Airbus A320neo', 'Airbus', 186, 6500, 'Disponible'),
('LV-KCD', 'Embraer E190', 'Embraer', 96, 4500, 'Disponible'),
('N538LA', 'Boeing 787-9', 'Boeing', 313, 14140, 'Disponible'),
('sdfghsdhs', 'adfhasdfcbz', 'adfywQAFDB', 10000000, 2147483647, 'Disponible');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `checkin`
--

DROP TABLE IF EXISTS `checkin`;
CREATE TABLE `checkin` (
  `IdCheckin` int(11) NOT NULL,
  `IdReserva` int(11) NOT NULL,
  `Estado` enum('Realizado','Cancelado') NOT NULL DEFAULT 'Realizado',
  `FechaCheckin` datetime NOT NULL DEFAULT current_timestamp(),
  `AsientoConfirmado` varchar(5) DEFAULT NULL,
  `CodigoEmbarque` varchar(30) DEFAULT NULL,
  `Observaciones` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Disparadores `checkin`
--
DROP TRIGGER IF EXISTS `validar_checkin`;
DELIMITER $$
CREATE TRIGGER `validar_checkin` BEFORE INSERT ON `checkin` FOR EACH ROW BEGIN
  DECLARE v_estado_reserva VARCHAR(30);
  DECLARE v_salida DATETIME;
  SELECT r.Estado,v.FechaHoraSalida INTO v_estado_reserva,v_salida
  FROM reservas r JOIN vuelos v ON v.IdVuelo=r.IdVuelo WHERE r.IdReserva=NEW.IdReserva;
  IF v_estado_reserva IS NULL OR v_estado_reserva NOT IN ('Confirmada','Completada') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El check-in requiere una reserva confirmada.';
  END IF;
  IF v_salida < NOW() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='No se puede hacer check-in para un vuelo que ya salió.';
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `equipajes`
--

DROP TABLE IF EXISTS `equipajes`;
CREATE TABLE `equipajes` (
  `IdEquipaje` int(11) NOT NULL,
  `IdReserva` int(11) NOT NULL,
  `Tipo` enum('Cabina','Bodega','Especial') NOT NULL DEFAULT 'Cabina',
  `Cantidad` int(11) NOT NULL DEFAULT 1,
  `PesoKg` decimal(6,2) NOT NULL DEFAULT 0.00,
  `Descripcion` varchar(255) DEFAULT NULL,
  `Costo` decimal(10,2) NOT NULL DEFAULT 0.00,
  `Estado` enum('Registrado','En tránsito','Entregado','Incidencia') NOT NULL DEFAULT 'Registrado',
  `CodigoEtiqueta` varchar(30) DEFAULT NULL,
  `FechaRegistro` timestamp NOT NULL DEFAULT current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pagos`
--

DROP TABLE IF EXISTS `pagos`;
CREATE TABLE `pagos` (
  `IdPago` int(11) NOT NULL,
  `IdReserva` int(11) NOT NULL,
  `Importe` decimal(10,2) NOT NULL,
  `Metodo` enum('Tarjeta','Transferencia','Efectivo','Otro') NOT NULL DEFAULT 'Tarjeta',
  `Estado` enum('Pendiente','Aprobado','Rechazado','Reembolsado') NOT NULL DEFAULT 'Pendiente',
  `ReferenciaProveedor` varchar(100) DEFAULT NULL,
  `Ultimos4` varchar(4) DEFAULT NULL,
  `FechaPago` datetime DEFAULT NULL,
  `FechaCreacion` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Volcado de datos para la tabla `pagos`
--

INSERT INTO `pagos` (`IdPago`, `IdReserva`, `Importe`, `Metodo`, `Estado`, `ReferenciaProveedor`, `Ultimos4`, `FechaPago`, `FechaCreacion`) VALUES
(1, 1, 850.00, 'Tarjeta', 'Aprobado', 'DEMO-PAGO-0001', '4242', '2026-10-01 12:00:00', '2026-10-30 21:35:49'),
(2, 2, 2400.00, 'Tarjeta', 'Aprobado', 'DEMO-PAGO-0002', '4242', '2026-10-01 12:05:00', '2026-10-30 21:35:49'),
(3, 3, 850.00, 'Tarjeta', 'Aprobado', 'DEMO-PAGO-0003', '4242', '2026-10-01 12:10:00', '2026-10-30 21:35:49'),
(4, 4, 320.00, 'Tarjeta', 'Aprobado', 'DEMO-PAGO-0004', '4242', '2026-10-01 12:15:00', '2026-10-30 21:35:49'),
(5, 5, 150.00, 'Tarjeta', 'Aprobado', 'DEMO-PAGO-0005', '4242', '2026-10-01 12:20:00', '2026-10-30 21:35:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pasajeros`
--

DROP TABLE IF EXISTS `pasajeros`;
CREATE TABLE `pasajeros` (
  `IdPasajero` int(11) NOT NULL,
  `Pasaporte` varchar(20) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `Contrasena` varchar(255) NOT NULL COMMENT 'Guardar hash bcrypt/Argon2, nunca texto plano en producción',
  `Telefono` varchar(20) DEFAULT NULL,
  `NroViajeroFrecuente` varchar(20) DEFAULT NULL,
  `Rol` enum('Pasajero') NOT NULL DEFAULT 'Pasajero',
  `Estado` enum('Activo','Suspendido') NOT NULL DEFAULT 'Activo',
  `FechaRegistro` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `pasajeros`
--

INSERT INTO `pasajeros` (`IdPasajero`, `Pasaporte`, `Nombre`, `Email`, `Contrasena`, `Telefono`, `NroViajeroFrecuente`, `Rol`, `Estado`, `FechaRegistro`) VALUES
(1, 'ARG123456', 'Carlos Gómez', 'carlos.gomez@email.com', 'passCarlos123', '+541144445555', 'VF-99821', 'Pasajero', 'Activo', '2026-10-30 21:35:49'),
(2, 'ESP789012', 'María Enríquez', 'maria.enriquez@email.com', 'passMaria456', '+34611223344', 'VF-10293', 'Pasajero', 'Activo', '2026-10-30 21:35:49'),
(3, 'USA456789', 'John Doe', 'john.doe@email.com', 'passJohn789', '+15551234567', NULL, 'Pasajero', 'Activo', '2026-10-30 21:35:49'),
(4, 'BRA987654', 'Aline Silva', 'aline.silva@email.com', 'passAline321', '+5511999998888', 'VF-55432', 'Pasajero', 'Activo', '2026-10-30 21:35:49'),
(5, 'ARG654321', 'Juan Pérez', 'juan.perez@email.com', 'passJuan654', '+5491133332222', NULL, 'Pasajero', 'Activo', '2026-10-30 21:35:49'),
(6, 'arg123412431341234', 'yo:yo:yo', 'yo@gmail.com', 'scrypt:4abf29e2f8298b44cf1fbbb4fb65b0de:0d4931e4f5ff522c44f3f21708adcf3257341cb7e0ca763722fc3f3c1b3398aa43e0ad657a6f65ee9736940ff11eeea8b46b2b2b98425b7826f3c39004e91eb3', NULL, NULL, 'Pasajero', 'Activo', '2026-10-30 22:26:16');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `reservas`
--

DROP TABLE IF EXISTS `reservas`;
CREATE TABLE `reservas` (
  `IdReserva` int(11) NOT NULL,
  `CodigoReserva` varchar(12) DEFAULT NULL,
  `IdPasajero` int(11) NOT NULL,
  `IdVuelo` int(11) NOT NULL,
  `NumeroAsiento` varchar(5) NOT NULL,
  `Clase` enum('Economy','Business','Primera') NOT NULL DEFAULT 'Economy',
  `Precio` decimal(10,2) NOT NULL,
  `Estado` enum('Pendiente de pago','Confirmada','Cancelada','Completada') NOT NULL DEFAULT 'Pendiente de pago',
  `FechaReserva` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Volcado de datos para la tabla `reservas`
--

INSERT INTO `reservas` (`IdReserva`, `CodigoReserva`, `IdPasajero`, `IdVuelo`, `NumeroAsiento`, `Clase`, `Precio`, `Estado`, `FechaReserva`) VALUES
(1, 'ALC000000001', 1, 1, '12A', 'Economy', 850.00, 'Confirmada', '2026-10-30 21:35:49'),
(2, 'ALC000000002', 2, 3, '03J', 'Business', 2400.00, 'Confirmada', '2026-10-30 21:35:49'),
(3, 'ALC000000003', 3, 1, '12B', 'Economy', 850.00, 'Confirmada', '2026-10-30 21:35:49'),
(4, 'ALC000000004', 4, 4, '08C', 'Economy', 320.00, 'Confirmada', '2026-10-30 21:35:49'),
(5, 'ALC000000005', 5, 2, '01A', 'Primera', 150.00, 'Confirmada', '2026-10-30 21:35:49');

--
-- Disparadores `reservas`
--
DROP TRIGGER IF EXISTS `antes_de_reservar_capacidad`;
DELIMITER $$
CREATE TRIGGER `antes_de_reservar_capacidad` BEFORE INSERT ON `reservas` FOR EACH ROW BEGIN
  DECLARE v_capacidad INT DEFAULT 0;
  DECLARE v_reservas_actuales INT DEFAULT 0;
  SELECT a.Capacidad INTO v_capacidad
  FROM vuelos v JOIN aviones a ON a.Matricula=v.Matricula
  WHERE v.IdVuelo=NEW.IdVuelo;
  SELECT COUNT(*) INTO v_reservas_actuales FROM reservas
  WHERE IdVuelo=NEW.IdVuelo AND Estado <> 'Cancelada';
  IF v_reservas_actuales >= v_capacidad THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El vuelo está completo; no hay asientos disponibles.';
  END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `validar_reserva_update`;
DELIMITER $$
CREATE TRIGGER `validar_reserva_update` BEFORE UPDATE ON `reservas` FOR EACH ROW BEGIN
  DECLARE v_capacidad INT DEFAULT 0;
  DECLARE v_reservas_actuales INT DEFAULT 0;
  IF NEW.IdVuelo <> OLD.IdVuelo AND NEW.Estado <> 'Cancelada' THEN
    SELECT a.Capacidad INTO v_capacidad FROM vuelos v JOIN aviones a ON a.Matricula=v.Matricula WHERE v.IdVuelo=NEW.IdVuelo;
    SELECT COUNT(*) INTO v_reservas_actuales FROM reservas WHERE IdVuelo=NEW.IdVuelo AND Estado <> 'Cancelada' AND IdReserva <> OLD.IdReserva;
    IF v_reservas_actuales >= v_capacidad THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El nuevo vuelo está completo.';
    END IF;
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tripulacion`
--

DROP TABLE IF EXISTS `tripulacion`;
CREATE TABLE `tripulacion` (
  `IdTripulante` int(11) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Rol` enum('Piloto','Copiloto','Comisario','Azafata') NOT NULL,
  `Certificacion` varchar(50) DEFAULT NULL,
  `Telefono` varchar(20) DEFAULT NULL,
  `Estado` enum('Activo','Inactivo') NOT NULL DEFAULT 'Activo'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `tripulacion`
--

INSERT INTO `tripulacion` (`IdTripulante`, `Nombre`, `Rol`, `Certificacion`, `Telefono`, `Estado`) VALUES
(1, 'Marcos González', 'Piloto', 'ATPL-A320/B737', '+541155556666', 'Activo'),
(2, 'Laura Martínez', 'Copiloto', 'CPL-B787/A350', '+541177778888', 'Activo'),
(3, 'Roberto Gómez', 'Comisario', 'TCP-Internacional', '+541122223333', 'Activo'),
(4, 'Ana López', 'Azafata', 'TCP-Nacional', '+541199990000', 'Activo'),
(5, 'Christian Dupont', 'Piloto', 'ATPL-A350', '+33144445555', 'Activo');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `IdUsuario` int(11) NOT NULL,
  `Nombre` varchar(100) NOT NULL,
  `Email` varchar(100) NOT NULL,
  `ContrasenaHash` varchar(255) NOT NULL,
  `Rol` enum('Administrador','Operador','Cajero') NOT NULL DEFAULT 'Operador',
  `Estado` enum('Activo','Suspendido') NOT NULL DEFAULT 'Activo',
  `FechaCreacion` timestamp NOT NULL DEFAULT current_timestamp(),
  `UltimoAcceso` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`IdUsuario`, `Nombre`, `Email`, `ContrasenaHash`, `Rol`, `Estado`, `FechaCreacion`, `UltimoAcceso`) VALUES
(1, 'una mierda', 'hola@aerolinea.local', 'scrypt:8a1f2fcbbbb0ebb04b75f8d2a27c55be:a3816091d5fa1951a47c1e58b3dae01197e698790c3836a051a50a405900a2f82258e39cb0e7c6cf406cafab6edbacbafe7d88937361ec48bc8e34c08bedd3dc', 'Administrador', 'Activo', '2026-10-30 22:49:10', '2026-10-30 20:19:19'),
(2, 'nose', 'a@aerolinea.local', 'scrypt:c5eaf42c38a60620843d07bc5328d364:b8def329c22a2d1f57cddab1da9c17430d280deb7253d1d646a31ce8956b1fb3d0fc0b166d61956ec7abba4186649911b0a5738d7a2ece9e115962b8ebd914b3', 'Cajero', 'Activo', '2026-10-30 22:54:33', '2026-10-30 19:57:00'),
(3, 'talvez', 'ji@aerolinea.local', 'scrypt:bdd02620b818c9a10649f228a3a69fc2:941d3ce42e4695641770ec59c64118cd77e6a81cbefd8478fac9886e2022f721d087984792d60b32b13a06d54e0eb8197951aad81bfeffb996baa7dcac604992', 'Operador', 'Activo', '2026-10-30 22:55:10', '2026-10-30 19:57:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `vuelos`
--

DROP TABLE IF EXISTS `vuelos`;
CREATE TABLE `vuelos` (
  `IdVuelo` int(11) NOT NULL,
  `Matricula` varchar(10) NOT NULL,
  `Origen` char(3) NOT NULL,
  `Destino` char(3) NOT NULL,
  `FechaHoraSalida` datetime NOT NULL,
  `FechaHoraLlegada` datetime NOT NULL,
  `Estado` enum('Programado','Embarcando','En vuelo','Finalizado','Cancelado','Demorado') NOT NULL DEFAULT 'Programado',
  `PrecioBase` decimal(10,2) NOT NULL DEFAULT 0.00,
  `FechaCreacion` timestamp NOT NULL DEFAULT current_timestamp()
) ;

--
-- Volcado de datos para la tabla `vuelos`
--

INSERT INTO `vuelos` (`IdVuelo`, `Matricula`, `Origen`, `Destino`, `FechaHoraSalida`, `FechaHoraLlegada`, `Estado`, `PrecioBase`, `FechaCreacion`) VALUES
(1, 'LV-FUA', 'EZE', 'MIA', '2026-11-15 23:30:00', '2026-11-16 07:30:00', 'Programado', 850.00, '2026-10-30 21:35:49'),
(2, 'LV-GHO', 'AEP', 'COR', '2026-11-16 08:00:00', '2026-11-16 09:15:00', 'Programado', 150.00, '2026-10-30 21:35:49'),
(3, 'N538LA', 'SCL', 'MAD', '2026-11-17 20:00:00', '2026-11-18 13:45:00', 'Programado', 1200.00, '2026-10-30 21:35:49'),
(4, 'LV-KCD', 'EZE', 'GRU', '2026-11-18 14:10:00', '2026-11-18 16:55:00', 'Programado', 320.00, '2026-10-30 21:35:49'),
(5, 'EC-MUT', 'MAD', 'EZE', '2026-11-19 23:55:00', '2026-11-20 07:50:00', 'Programado', 950.00, '2026-10-30 21:35:49'),
(6, 'N538LA', 'EZE', 'MIA', '2026-12-02 23:30:00', '2026-12-03 07:30:00', 'Programado', 880.00, '2026-10-30 21:35:49'),
(7, 'N538LA', 'MIA', 'EZE', '2026-12-05 21:00:00', '2026-12-06 06:30:00', 'Programado', 880.00, '2026-10-30 21:35:49'),
(8, 'LV-KCD', 'AEP', 'COR', '2026-12-02 08:00:00', '2026-12-02 09:15:00', 'Programado', 145.00, '2026-10-30 21:35:49'),
(9, 'LV-KCD', 'COR', 'AEP', '2026-12-04 18:00:00', '2026-12-04 19:15:00', 'Programado', 145.00, '2026-10-30 21:35:49'),
(10, 'LV-GHO', 'EZE', 'GRU', '2026-12-03 14:10:00', '2026-12-03 16:55:00', 'Programado', 310.00, '2026-10-30 21:35:49'),
(11, 'LV-GHO', 'GRU', 'EZE', '2026-12-06 17:30:00', '2026-12-06 19:20:00', 'Programado', 310.00, '2026-10-30 21:35:49'),
(12, 'EC-MUT', 'EZE', 'MAD', '2026-12-05 20:00:00', '2026-12-06 13:45:00', 'Programado', 950.00, '2026-10-30 21:35:49'),
(13, 'EC-MUT', 'MAD', 'EZE', '2026-12-10 23:55:00', '2026-12-11 07:50:00', 'Programado', 950.00, '2026-10-30 21:35:49'),
(14, 'N538LA', 'SCL', 'MAD', '2026-12-07 20:00:00', '2026-12-08 13:45:00', 'Programado', 1200.00, '2026-10-30 21:35:49'),
(15, 'N538LA', 'MAD', 'SCL', '2026-12-12 20:00:00', '2026-12-13 07:00:00', 'Programado', 1200.00, '2026-10-30 21:35:49'),
(16, 'LV-FUA', 'EZE', 'SCL', '2026-12-08 10:00:00', '2026-12-08 13:00:00', 'Programado', 280.00, '2026-10-30 21:35:49'),
(17, 'LV-FUA', 'SCL', 'EZE', '2026-12-10 14:30:00', '2026-12-10 17:30:00', 'Programado', 280.00, '2026-10-30 21:35:49'),
(18, 'sdfghsdhs', 'COR', 'ARC', '2026-10-31 20:17:00', '2026-11-07 20:17:00', 'Cancelado', 99999999.99, '2026-10-30 23:17:20');

--
-- Disparadores `vuelos`
--
DROP TRIGGER IF EXISTS `validar_horarios_vuelo_insert`;
DELIMITER $$
CREATE TRIGGER `validar_horarios_vuelo_insert` BEFORE INSERT ON `vuelos` FOR EACH ROW BEGIN
  IF NEW.FechaHoraLlegada <= NEW.FechaHoraSalida THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La llegada debe ser posterior a la salida.';
  END IF;
  IF NEW.Origen = NEW.Destino THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El origen y el destino deben ser diferentes.';
  END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `validar_horarios_vuelo_update`;
DELIMITER $$
CREATE TRIGGER `validar_horarios_vuelo_update` BEFORE UPDATE ON `vuelos` FOR EACH ROW BEGIN
  IF NEW.FechaHoraLlegada <= NEW.FechaHoraSalida THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La llegada debe ser posterior a la salida.';
  END IF;
  IF NEW.Origen = NEW.Destino THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El origen y el destino deben ser diferentes.';
  END IF;
END
$$
DELIMITER ;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `aeropuertos`
--
ALTER TABLE `aeropuertos`
  ADD PRIMARY KEY (`CodigoIATA`);

--
-- Indices de la tabla `asignaciontripulacion`
--
ALTER TABLE `asignaciontripulacion`
  ADD PRIMARY KEY (`IdVuelo`,`IdTripulante`),
  ADD KEY `idx_asignacion_tripulante` (`IdTripulante`);

--
-- Indices de la tabla `aviones`
--
ALTER TABLE `aviones`
  ADD PRIMARY KEY (`Matricula`);

--
-- Indices de la tabla `checkin`
--
ALTER TABLE `checkin`
  ADD PRIMARY KEY (`IdCheckin`),
  ADD UNIQUE KEY `uq_checkin_reserva` (`IdReserva`),
  ADD UNIQUE KEY `uq_checkin_embarque` (`CodigoEmbarque`);

--
-- Indices de la tabla `equipajes`
--
ALTER TABLE `equipajes`
  ADD PRIMARY KEY (`IdEquipaje`),
  ADD UNIQUE KEY `uq_equipaje_etiqueta` (`CodigoEtiqueta`),
  ADD KEY `idx_equipaje_reserva` (`IdReserva`);

--
-- Indices de la tabla `pagos`
--
ALTER TABLE `pagos`
  ADD PRIMARY KEY (`IdPago`),
  ADD KEY `idx_pagos_reserva` (`IdReserva`);

--
-- Indices de la tabla `pasajeros`
--
ALTER TABLE `pasajeros`
  ADD PRIMARY KEY (`IdPasajero`),
  ADD UNIQUE KEY `uq_pasajeros_pasaporte` (`Pasaporte`),
  ADD UNIQUE KEY `uq_pasajeros_email` (`Email`),
  ADD UNIQUE KEY `uq_pasajeros_viajero` (`NroViajeroFrecuente`);

--
-- Indices de la tabla `reservas`
--
ALTER TABLE `reservas`
  ADD PRIMARY KEY (`IdReserva`),
  ADD UNIQUE KEY `uq_vuelo_asiento` (`IdVuelo`,`NumeroAsiento`),
  ADD UNIQUE KEY `uq_reservas_codigo` (`CodigoReserva`),
  ADD KEY `idx_reservas_pasajero` (`IdPasajero`),
  ADD KEY `idx_reservas_estado` (`Estado`);

--
-- Indices de la tabla `tripulacion`
--
ALTER TABLE `tripulacion`
  ADD PRIMARY KEY (`IdTripulante`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`IdUsuario`),
  ADD UNIQUE KEY `uq_usuarios_email` (`Email`);

--
-- Indices de la tabla `vuelos`
--
ALTER TABLE `vuelos`
  ADD PRIMARY KEY (`IdVuelo`),
  ADD KEY `idx_vuelos_ruta_fecha` (`Origen`,`Destino`,`FechaHoraSalida`),
  ADD KEY `idx_vuelos_matricula` (`Matricula`),
  ADD KEY `fk_vuelos_destino` (`Destino`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `checkin`
--
ALTER TABLE `checkin`
  MODIFY `IdCheckin` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `equipajes`
--
ALTER TABLE `equipajes`
  MODIFY `IdEquipaje` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pagos`
--
ALTER TABLE `pagos`
  MODIFY `IdPago` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pasajeros`
--
ALTER TABLE `pasajeros`
  MODIFY `IdPasajero` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT de la tabla `reservas`
--
ALTER TABLE `reservas`
  MODIFY `IdReserva` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `tripulacion`
--
ALTER TABLE `tripulacion`
  MODIFY `IdTripulante` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `IdUsuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `vuelos`
--
ALTER TABLE `vuelos`
  MODIFY `IdVuelo` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `asignaciontripulacion`
--
ALTER TABLE `asignaciontripulacion`
  ADD CONSTRAINT `fk_asignacion_tripulante` FOREIGN KEY (`IdTripulante`) REFERENCES `tripulacion` (`IdTripulante`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_asignacion_vuelo` FOREIGN KEY (`IdVuelo`) REFERENCES `vuelos` (`IdVuelo`) ON DELETE CASCADE;

--
-- Filtros para la tabla `checkin`
--
ALTER TABLE `checkin`
  ADD CONSTRAINT `fk_checkin_reserva` FOREIGN KEY (`IdReserva`) REFERENCES `reservas` (`IdReserva`) ON DELETE CASCADE;

--
-- Filtros para la tabla `equipajes`
--
ALTER TABLE `equipajes`
  ADD CONSTRAINT `fk_equipajes_reserva` FOREIGN KEY (`IdReserva`) REFERENCES `reservas` (`IdReserva`) ON DELETE CASCADE;

--
-- Filtros para la tabla `pagos`
--
ALTER TABLE `pagos`
  ADD CONSTRAINT `fk_pagos_reserva` FOREIGN KEY (`IdReserva`) REFERENCES `reservas` (`IdReserva`) ON DELETE CASCADE;

--
-- Filtros para la tabla `reservas`
--
ALTER TABLE `reservas`
  ADD CONSTRAINT `fk_reservas_pasajero` FOREIGN KEY (`IdPasajero`) REFERENCES `pasajeros` (`IdPasajero`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_reservas_vuelo` FOREIGN KEY (`IdVuelo`) REFERENCES `vuelos` (`IdVuelo`) ON DELETE CASCADE;

--
-- Filtros para la tabla `vuelos`
--
ALTER TABLE `vuelos`
  ADD CONSTRAINT `fk_vuelos_avion` FOREIGN KEY (`Matricula`) REFERENCES `aviones` (`Matricula`),
  ADD CONSTRAINT `fk_vuelos_destino` FOREIGN KEY (`Destino`) REFERENCES `aeropuertos` (`CodigoIATA`),
  ADD CONSTRAINT `fk_vuelos_origen` FOREIGN KEY (`Origen`) REFERENCES `aeropuertos` (`CodigoIATA`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
