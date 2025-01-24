import multer from "multer";
import pool from "../database.js";
import jwt from 'jsonwebtoken';
import axios from "axios";

export const crearUsuario = async (req, res) => {
    const {
      dni,
      ruc,
      nombre,
      apellido,
      direccion,
      distritoId,
      nombreBodega,
      metodoAfiliacion,
      referencia,
      correo,
      observaciones,
    } = req.body;

    if (!dni || !ruc || !nombre || !apellido || !distritoId || !correo || !nombreBodega || !apellido) {
        return res.status(400).json({ error: "Faltan campos obligatorios" });
    }      
  
    const query = `
      INSERT INTO Afiliados (
        dni, ruc, nombre, apellido, direccion, distritoId, 
        nombreBodega, estadoSocio, metodoAfiliacion, 
        estadoWhatsapp, estadoGrupo, referencia, correo, observaciones
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
  
    const values = [
      dni,
      ruc,
      nombre,
      apellido,
      direccion,
      distritoId,
      nombreBodega,
      1,
      metodoAfiliacion,
      1,
      1,
      referencia,
      correo,
      observaciones,
    ];

    try {
        const [response] = await pool.query(query, values)
        res.status(200).json(response)
    } catch (error) {
        res.status(400).json({error})
    }

  };

  const EstadoAfiliado = [
    { id: 1, nombre: 'Nuevo' },
    { id: 2, nombre: 'Renovo' },
    { id: 3, nombre: 'Suspendido' }
];

const EstadoWhatsapp = [
    { id: 1, nombre: 'No definido' },
    { id: 2, nombre: 'Activo' },
    { id: 3, nombre: 'Inactivo' }
];

export const getUsuario = async (req, res) => {
    const query = `
        SELECT 
            a.id, 
            a.dni, 
            a.ruc, 
            a.nombre, 
            a.apellido, 
            a.direccion, 
            d.nombre AS distrito,  -- Nombre del distrito
            a.nombreBodega, 
            a.estadoSocio, 
            ma.nombre AS metodoAfiliacion,  -- Nombre del método de afiliación
            a.estadoWhatsapp, 
            g.nombre AS estadoGrupo,  -- Nombre del estado del grupo
            a.referencia, 
            a.correo, 
            a.observaciones, 
            a.fechaAfiliacion,
            -- Subconsulta para obtener los teléfonos
            (SELECT GROUP_CONCAT(t.numero ORDER BY t.id ASC) 
             FROM Telefono t 
             WHERE t.afiliadoId = a.id) AS telefonos,
            -- Subconsulta para obtener las fechas de pago
            (SELECT GROUP_CONCAT(fp.fecha ORDER BY fp.fecha ASC) 
             FROM fechaPago fp 
             WHERE fp.afiliadoId = a.id) AS fechasPago
        FROM 
            Afiliados a
        JOIN 
            Distrito d 
        ON 
            a.distritoId = d.id
        LEFT JOIN 
            MetodoAfiliacion ma 
        ON 
            a.metodoAfiliacion = ma.id
        LEFT JOIN 
            Grupo g 
        ON 
            a.estadoGrupo = g.id;
    `;

    try {
        const [results] = await pool.query(query);

        // Mapea el estadoSocio y estadoWhatsapp para obtener los nombres correspondientes
        const resultsWithStates = results.map((afiliado) => {
            const estadoSocio = EstadoAfiliado.find((e) => e.id === afiliado.estadoSocio);
            const estadoWhatsapp = EstadoWhatsapp.find((e) => e.id === afiliado.estadoWhatsapp);

            return {
                ...afiliado,
                estadoSocio: estadoSocio ? estadoSocio.nombre : 'Estado desconocido', // Mapea estadoSocio
                estadoWhatsapp: estadoWhatsapp ? estadoWhatsapp.nombre : 'Estado desconocido', // Mapea estadoWhatsapp
                fechaAfiliacion: afiliado.fechaAfiliacion.toISOString().split('T')[0], // Formatear fecha a 'YYYY-MM-DD'
                // Convertir el campo 'telefonos' de string (concat) a array
                telefonos: afiliado.telefonos ? afiliado.telefonos.split(',') : [],
                // Convertir el campo 'fechasPago' de string (concat) a array
                fechasPago: afiliado.fechasPago ? afiliado.fechasPago.split(',') : []
            };
        });

        res.status(200).json(resultsWithStates);
    } catch (err) {
        console.error('Error al obtener los usuarios:', err);
        res.status(500).json({ message: 'Error al obtener los usuarios' });
    }
};




export const getUsuariosId = async (req, res) => {
    const query = 'SELECT * FROM Distrito';

    try {
        const [results] = await pool.query(query);
        res.status(200).json(results);
    } catch (err) {
        console.error('Error al obtener los usuarios:', err);
        res.status(500).json({ message: 'Error al obtener los usuarios' });
    }
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');  // Carpeta donde se guardarán las imágenes
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);  // Guardar la imagen con nombre único
    }
});

export const upload = multer({ storage: storage });

export const FotoPerfil = async (req, res) => {
    try {
        const Id = req.params.id;
        const imagePath = req.file.filename;  // Obtener el nombre del archivo guardado

        // Actualizar la ruta de la imagen en la base de datos
        const query = 'UPDATE Usuarios SET fotoPerfil = ? WHERE Id = ?';
        const [result] = await pool.query(query, [imagePath, Id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(201).json({ fotoPerfil: imagePath, message: 'Éxito' });
    } catch (err) {
        console.error("Error actualizando la imagen de perfil:", err);
        res.status(500).send("Error al actualizar la imagen de perfil");
    }
};

function generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '5h' });
}

export const loginUsuario = async (req, res) => {
    const { usuario, contraseña } = req.body;

    if (!usuario || !contraseña) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const query = 'SELECT * FROM Usuario WHERE usuario = ?';

    try {
        // Buscar el usuario por nombre de usuario
        const [rows] = await pool.query(query, [usuario]);

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        const usuarioDb = rows[0];  // Cambié el nombre para evitar conflicto

        // Comparar la contraseña proporcionada con la almacenada (sin encriptación)
        if (contraseña !== usuarioDb.contraseña) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }

        // Crear el payload del token con información relevante del usuario
        const tokenPayload = {
            id: usuarioDb.id,
            nombre: usuarioDb.nombre,
            apellido: usuarioDb.apellido,
        };

        // Generar Access Token y Refresh Token
        const accessToken = generateAccessToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);

        // Configuración para el refreshToken (5 horas)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 5 * 60 * 60 * 1000,  // 5 horas
            sameSite: 'None',
        });

        // Configuración para el accessToken (1 hora)
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1 * 60 * 60 * 1000,  // 1 hora
            sameSite: 'None',
        });

        // Responder con éxito, incluyendo los datos del usuario y el access token generado
        return res.status(200).json({
            success: true,
            message: 'Bienvenido',
            token: accessToken,  // Enviar el accessToken en la respuesta
        });

    } catch (error) {
        console.error('Error del servidor:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

export const verificarToken = async (req, res, next) => {
    const { accessToken } = req.cookies;  // Obtenemos el accessToken desde las cookies

    if (!accessToken) {
        // Si no hay accessToken, intentamos renovar el token
        const tokenRenovado = await refreshToken(req, res);  // Llamamos a refreshToken asincrónicamente

        if (!tokenRenovado) {
            return res.status(401).json({ message: 'No autorizado, no se pudo renovar el token' });
        }

        // Si el token se renovó correctamente, procedemos al siguiente middleware
        return next();  // Añadimos "return" para evitar que se ejecute código posterior
    } else {
        // Si hay un accessToken, verificamos su validez
        jwt.verify(accessToken, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Token inválido o expirado', error: err.message });
            }

            // Si el token es válido, guardamos la información del usuario decodificada en req.usuario
            req.usuario = decoded;  // Guardamos los datos del usuario decodificados
            console.log("Usuario verificado:", req.usuario);

            // Continuamos con el siguiente middleware o ruta
            return next();  // Añadimos "return" aquí para evitar que se ejecute código posterior
        });
    }
};

export const postTelefono = async (req, res) => {
    const { id } = req.params; // El id del afiliado
    try {
      const { numero } = req.body; // El número de teléfono que se recibe en el cuerpo de la solicitud
  
      // Insertar el número de teléfono en la tabla Telefono
      const sql = 'INSERT INTO Telefono (numero, afiliadoId) VALUES (?, ?)';
      const [results] = await pool.query(sql, [numero, id]);
  
      res.status(201).json({ message: 'Teléfono agregado exitosamente' });
    } catch (error) {
      console.error('Error inserting data:', error);
      return res.status(500).json({ error: 'Error inserting data' });
    }
  };

  export const postFechaPago = async (req, res) => {
    const { id } = req.params; // El id del afiliado
    try {
      // Obtener la fecha de hoy en formato 'YYYY-MM-DD'
      const today = new Date();
      const fecha = today.toISOString().split('T')[0]; // Esto obtiene solo la parte de la fecha 'YYYY-MM-DD'
  
      // Insertar la fecha en la tabla FechaPago
      const sql = 'INSERT INTO fechaPago (fecha, afiliadoId) VALUES (?, ?)';
      const [results] = await pool.query(sql, [fecha, id]);
  
      res.status(201).json({ 
        message: 'Fecha agregada exitosamente', 
        fechaIngresada: fecha // Imprimir la fecha ingresada
      });
    } catch (error) {
      console.error('Error inserting data:', error);
      return res.status(500).json({ error: 'Error inserting data' });
    }
  };  

export const postRol = async (req, res) => {
    try {
        const { nombre } = req.body;

        // Insert data into the database
        const sql = 'INSERT INTO Grupo (nombre) VALUES (?)';
        const [results] = await pool.query(sql, [nombre]);

        res.status(201).json({message: 'Grupo creado exitosamente' });
    } catch (error) {
        console.error('Error inserting data:', error);
        return res.status(500).json({ error: 'Error inserting data' });
    }
};

export const posMetodo = async (req, res) => {
    try {
        const { nombre } = req.body;

        // Insert data into the database
        const sql = 'INSERT INTO metodoafiliacion (nombre) VALUES (?)';
        const [results] = await pool.query(sql, [nombre]);

        res.status(201).json({message: 'metodo de afiliacion creado exitosamente' });
    } catch (error) {
        console.error('Error inserting data:', error);
        return res.status(500).json({ error: 'Error inserting data' });
    }
};

export const logoutUsuario= async (req, res) => {
    try {
        // Eliminar las cookies de acceso y refresco
        res.clearCookie('accessToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None',
        });

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'None',
        });

        // Responder con éxito
        return res.status(200).json({ message: 'Logout exitoso' });
    } catch (error) {
        console.error('Error al hacer logout:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }


}

export const refreshToken = async (req, res) => {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
        return false;  // Si no hay refresh token, no podemos renovar
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const newAccessToken = generateAccessToken({ id: decoded.id, correo: decoded.correo });

        // Si los encabezados ya fueron enviados, no hacemos nada más
        if (res.headersSent) {
            return false;
        }

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Solo en producción, usar https
            sameSite: 'None',
            maxAge: 1 * 60 * 60 * 1000, // 1 hora
        });

        // Retornar un valor para indicar que el token fue renovado
        return true;
    } catch (err) {
        // Si ocurre un error al verificar el refreshToken, no renovar el accessToken
        return false;
    }
};
export const me = async (req, res) => {
    const user = req.usuario; // Los datos del usuario decodificados desde el JWT

    try {
        // Consultar la base de datos para obtener la información del usuario, incluyendo rol_id, dirección y teléfono
        const [rows] = await pool.query(`
            SELECT 
                u.id AS usuarioId, 
                u.correo, 
                u.nombres, 
                u.apellidos, 
                u.fotoPerfil, 
                u.clinica_id, 
                r.nombre AS rol,
                v.id AS vistaId, 
                v.nombre AS vistaNombre, 
                v.logo, 
                v.ruta,
                u.estado AS estado,  
                u.estadoPr AS estadoPr,  
                u.codigo AS codigo,
                u.direccion,  -- Agregar el campo dirección
                u.telefono    -- Agregar el campo teléfono
            FROM 
                Usuarios u
            LEFT JOIN 
                Roles r ON u.rol_id = r.id
            LEFT JOIN 
                Vistas v ON r.id = v.rol_id
            WHERE 
                u.id = ?;
        `, [user?.id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Extraer la información del usuario
        const usuario = rows[0];

        // Agrupar las vistas en un array
        const vistas = rows.map(row => ({
            id: row.vistaId,
            nombre: row.vistaNombre,
            logo: row.logo,
            ruta: row.ruta
        }));

        // Devolver los datos del usuario, las vistas, estado, estadoPr, código, rol_id, dirección y teléfono
        res.status(200).json({
            id: usuario.usuarioId,
            correo: usuario.correo,
            nombres: usuario.nombres,
            apellidos: usuario.apellidos,
            fotoPerfil: usuario.fotoPerfil,
            rol: usuario.rol,
            rol_id: usuario.rol_id,  // Incluir rol_id
            clinica_id: usuario.clinica_id || null, 
            estado: usuario.estado || 'No disponible', 
            estadoPr: usuario.estadoPr || 'No disponible', 
            codigo: usuario.codigo || 'No disponible', 
            direccion: usuario.direccion || 'No disponible',  // Incluir dirección
            telefono: usuario.telefono || 'No disponible',  // Incluir teléfono
            vistas: vistas 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener los datos del usuario' });
    }
}

export const Notificaciones = async (req, res) => {
    try {
        const { usuarioId } = req.params;

        // Obtener las notificaciones más recientes (3), ordenadas por fecha
        const [notificaciones] = await pool.query(
            'SELECT * FROM Notificaciones WHERE es_global = TRUE OR usuario_id = ?',
            [usuarioId]
        );

        // Formatear la fecha de cada notificación para que sea solo "YYYY-MM-DD"
        const notificacionesFormateadas = notificaciones.map(notification => {
            const fecha = new Date(notification.fecha);
            // Obtener el formato "YYYY-MM-DD"
            const fechaFormateada = fecha.toISOString().split('T')[0];
            return {
                ...notification,
                fecha: fechaFormateada
            };
        });

        // Enviar las notificaciones con la fecha formateada
        res.status(200).json(notificacionesFormateadas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
};


export const CreateMensagge = async (req, res) => {
    const { mensaje } = req.body;

    try {
        // Crear notificación global
        await pool.query('INSERT INTO Notificaciones (mensaje, es_global) VALUES (?, ?)', [mensaje, true]);

        res.status(200).send({ message: 'Notificación global enviada exitosamente' });
    } catch (error) {
        res.status(500).send({ error: 'Error al enviar notificación global' });
    }
};

