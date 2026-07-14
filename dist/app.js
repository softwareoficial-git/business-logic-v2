"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const Dispatcher_1 = require("./core/Dispatcher");
const ErrorHandler_1 = require("./core/ErrorHandler");
// Middlewares basicos
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
// Middleware para construir el RequestContext desde las cookies/headers
const contextMiddleware = async (req, res, next) => {
    const token = req.cookies.session_token || req.headers.authorization?.toString().replace('Bearer ', '');
    const { cmd } = req.body;
    // Permitir login sin token
    if (cmd === 'USER:login') {
        req.context = {
            tenantId: 0,
            userId: 'guest',
            role: 'GUEST',
            plan: 'free',
            token: token || '',
            source: 'FRONTEND',
            requestId: req.headers['x-request-id']?.toString() || Math.random().toString(36).substring(7),
            userAgent: req.headers['user-agent']?.toString(),
            ipAddress: req.ip
        };
        return next();
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'No session token found' });
    }
    try {
        // VALIDACIÓN REAL: Consultamos a la Infra API el perfil del usuario usando el token
        // Usamos un contexto mínimo para la validación ya que el token es la fuente de verdad
        const profileResult = await Dispatcher_1.dispatcher.execute('USER:get-profile', {}, {
            token: token,
            tenantId: 0,
            userId: 'unknown',
            role: 'GUEST',
            plan: 'free',
            source: 'FRONTEND',
            requestId: req.headers['x-request-id']?.toString() || 'auth-val',
            userAgent: req.headers['user-agent']?.toString(),
            ipAddress: req.ip
        });
        if (!profileResult.success || !profileResult.data?.profile) {
            return res.status(401).json({ success: false, message: 'Session expired or invalid' });
        }
        const user = profileResult.data.profile;
        req.context = {
            tenantId: user.cliente_id || 0,
            userId: user.id ? user.id.toString() : 'unknown',
            role: user.role_name || 'USER',
            plan: 'pro',
            token: token,
            source: 'FRONTEND',
            requestId: req.headers['x-request-id']?.toString() || Math.random().toString(36).substring(7),
            userAgent: req.headers['user-agent']?.toString(),
            ipAddress: req.ip
        };
        next();
    }
    catch (error) {
        console.error('[AUTH_MIDDLEWARE_ERROR]', error);
        return res.status(500).json({ success: false, message: 'Authentication service error' });
    }
};
app.get('/health', (req, res) => res.json({ status: 'online', version: '2.0.0' }));
app.post('/register', async (req, res) => {
    const { username, password, nombreCliente } = req.body;
    if (!username || !password || !nombreCliente) {
        return res.status(400).json({
            success: false,
            message: 'username, password and nombreCliente are required'
        });
    }
    try {
        // Importante: Usamos el comando exacto que Infra Engine reconoce: 'APP:self-register'
        // Pasamos el payload directamente. InfraClient.execute ya envuelve esto en { token, cmd, payload }
        const result = await infraClient.execute('APP:self-register', {
            username,
            password,
            nombreCliente,
        }, '');
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: result.data
        });
    }
    catch (error) {
        console.error('[REGISTER_ERROR]', error);
        res.status(500).json({ success: false, message: 'Internal registration error' });
    }
});
app.get('/commands', (req, res) => {
    const commands = Dispatcher_1.dispatcher.getAvailableCommands();
    res.json({
        success: true,
        total: commands.length,
        commands: commands
    });
});
app.post('/execute', contextMiddleware, async (req, res) => {
    console.log('[DEBUG] /execute body:', req.body);
    const { cmd, params } = req.body;
    const context = req.context;
    if (!cmd) {
        return res.status(400).json({ success: false, message: 'Missing cmd parameter' });
    }
    try {
        const result = await Dispatcher_1.dispatcher.execute(cmd, params || {}, context);
        if (!result.success) {
            const appError = ErrorHandler_1.ErrorHandler.handle(result);
            return res.status(appError.statusCode).json(ErrorHandler_1.ErrorHandler.formatForFrontend(appError));
        }
        // --- SESSION ABSTRACTION LAYER ---
        // If the command was login and we have a token, set it as an HTTP-only cookie
        if (cmd === 'USER:login' && result.data?.token) {
            res.cookie('session_token', result.data.token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            // Remove token from the JSON response so the frontend never sees it
            const { token, ...restData } = result.data;
            result.data = { ...restData, sessionEstablished: true };
        }
        // If the command was logout, clear the session cookie
        if (cmd === 'USER:logout') {
            res.clearCookie('session_token');
        }
        // --------------------------------
        res.json(result);
    }
    catch (error) {
        const appError = ErrorHandler_1.ErrorHandler.handle(error);
        res.status(appError.statusCode).json(ErrorHandler_1.ErrorHandler.formatForFrontend(appError));
    }
});
exports.default = app;
