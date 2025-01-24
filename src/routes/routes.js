import { Router } from "express";
import {
    getUsuario, loginUsuario, postRol, crearUsuario, getUsuariosId,FotoPerfil, upload,verificarToken,
    refreshToken,me,logoutUsuario,
    Notificaciones,
    CreateMensagge,
    posMetodo,
    postTelefono,
    postFechaPago
} from "../controller/UserController.js";

const router = Router();

router.post('/login', loginUsuario);
// Crear un nuevo usuario
router.post('/CreateUsuario', verificarToken, crearUsuario);

// Obtener lista de usuarios
router.get('/list', verificarToken, getUsuario);

// Obtener usuario por ID
router.get('/distritos', verificarToken, getUsuariosId);

router.post('/CreateGrupo', verificarToken, postRol);

router.post('/CreateMetodo', verificarToken, posMetodo);

router.post('/CreateTelefono/:id',verificarToken,postTelefono)

router.post('/CreateFechaPago/:id',verificarToken,postFechaPago)

router.post('/Usuario/:id/uploadProfileImage', verificarToken, upload.single('image'), FotoPerfil);

router.get('/notificaciones/:usuarioId',Notificaciones)

router.post('/CreateNotificaciones', CreateMensagge)

router.post('/refresh-token',refreshToken)
router.get("/me",verificarToken,me)
router.post("/logout",verificarToken,logoutUsuario)

export default router;
