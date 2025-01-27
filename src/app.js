import express from 'express';
import { engine } from 'express-handlebars';
import morgan from 'morgan';
import path, { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import usuarios from './routes/routes.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';


const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config();
const corsOptions = {
    origin: ['https://darkgrey-ostrich-727682.hostingersite.com', 'http://localhost:3000','https://dniruc.apisperu.com'], // Orígenes permitidos
    methods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE'], // Métodos HTTP permitidos
    credentials: true, // Permite enviar cookies y encabezados de autorización
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Manejo de preflight
app.set('views', join(__dirname, 'views'));
app.engine('hbs', engine({
    defaultLayout: 'main',
    layoutsDir: join(app.get('views'), 'layouts'),
    partialsDir: join(app.get('views'), 'partials'),
    extname: '.hbs'
}));
app.set('view engine', '.hbs');

app.use(morgan('dev'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Configurar la carpeta uploads como estática
app.use('/FilePdf', express.static(path.join(__dirname, '../FilePdf')));
app.use('/uploads', express.static('uploads'));

// Rutas
app.get('/', async (req, res) => {
    res.status(200).json({ message: 'hello world' });
});

app.use(usuarios);

// Estática
app.use(express.static(join(__dirname, 'public')));

export default app;

