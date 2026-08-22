"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const Dispatcher_1 = require("./core/Dispatcher");
const InfraClient_1 = require("./core/InfraClient");
const ErrorHandler_1 = require("./core/ErrorHandler");
const CsrfMiddleware_1 = require("./core/CsrfMiddleware");
const PartnerAuthMiddleware_1 = require("./core/PartnerAuthMiddleware");
const billing_1 = require("./modules/billing");
const schema_1 = require("./modules/schema");
const product_1 = require("./modules/product");
const web_1 = require("./modules/web");
const store_controller_1 = require("./public-api/controllers/store-controller");
// Forzar inicialización de módulos
billing_1.billingModule;
schema_1.schemaModule;
product_1.productModule;
web_1.webModule;
// ... (después de importaciones)
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execPromise = util_1.default.promisify(child_process_1.exec);
// Middlewares basicos
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
// Middleware CSRF condicional: excluir rutas de API
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    (0, CsrfMiddleware_1.csrfMiddleware)(req, res, next);
});
// NUEVA RUTA: API PÚBLICA DE PRODUCTOS (Solo lectura)
app.get('/api/public/store/:tenantId/details', store_controller_1.PublicStoreController.getStoreDetails);
app.get('/api/public/store/:tenantId/products', store_controller_1.PublicStoreController.getProducts);
app.get('/api/public/store/name/:tenantName/products', store_controller_1.PublicStoreController.getProductsByName);
app.get('/api/public/store/check-name/:storeNameSlug', store_controller_1.PublicStoreController.checkStoreNameAvailability);
// Webhook Dinámico por Tenant
app.post('/api/billing/webhook/:tenantId', async (req, res) => {
    const { tenantId } = req.params;
    console.log(`[WEBHOOK] Notificación directa recibida para tenant ${tenantId}`);
    try {
        // Invocamos el handler pasando el tenantId y el body completo para validación
        await billing_1.billingModule.handlePaymentNotification(parseInt(tenantId), req.body, req.headers);
        res.status(200).send('OK');
    }
    catch (error) {
        console.error(`[WEBHOOK_ERROR] Tenant: ${tenantId}`, error);
        res.status(500).send('Error');
    }
});
// Endpoint para crear preferencias de pago
app.post('/api/billing/create-payment', async (req, res) => {
    const { plan, amount, tenantId } = req.body;
    // Obtenemos el contexto simulado para el usuario (o deberíamos usar el del middleware si fuera una ruta protegida)
    const context = {
        tenantId: parseInt(tenantId),
        role: 'DUEÑO', // Asumimos rol para la prueba
        token: process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN'
    };
    try {
        const result = await Dispatcher_1.dispatcher.execute('billing.create-preference', { plan, amount }, context);
        res.json(result);
    }
    catch (error) {
        console.error('[PAYMENT_ERROR]', error);
        res.status(500).json({ success: false, message: 'Error al crear preferencia' });
    }
});
// ... (resto de app.ts)
// Middleware para construir el RequestContext desde las cookies/headers
const contextMiddleware = async (req, res, next) => {
    console.log('[DEBUG] Cookies recibidas:', req.cookies);
    const token = req.cookies.session_token || req.headers.authorization?.toString().replace('Bearer ', '');
    const { cmd } = req.body;
    // Permitir login y track-visit sin token
    if (cmd === 'USER:login' || cmd === 'ANALYTICS:track-visit') {
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
            tenantId: user.cliente_id,
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
// DIAGNÓSTICO TEMPORAL: Verificar configuración Cloudinary
app.get('/debug-env', (req, res) => {
    res.json({
        hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
        hasApiKey: !!process.env.CLOUDINARY_API_KEY,
        hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
    });
});
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
        const result = await InfraClient_1.infraClient.execute('APP:self-register', {
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
                secure: false, // Cambiado para desarrollo local
                sameSite: 'lax', // Cambiado para desarrollo local
                maxAge: 24 * 60 * 60 * 1000 // 24 hours
            });
            // Include token in user object for cross-origin compatibility, instead of removing it
            const { token, ...restData } = result.data;
            if (restData.user) {
                restData.user.token = token;
            }
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
// Nueva ruta para partners externos
app.post('/api/partner/execute', PartnerAuthMiddleware_1.partnerAuth, async (req, res) => {
    const { cmd, params } = req.body;
    const context = req.context;
    if (!context.permissions || !context.permissions.includes(cmd)) {
        return res.status(403).json({ success: false, message: 'Permiso denegado para este comando' });
    }
    try {
        const result = await Dispatcher_1.dispatcher.execute(cmd, params || {}, context);
        if (!result.success) {
            const appError = ErrorHandler_1.ErrorHandler.handle(result);
            return res.status(appError.statusCode).json(ErrorHandler_1.ErrorHandler.formatForFrontend(appError));
        }
        res.json(result);
    }
    catch (error) {
        const appError = ErrorHandler_1.ErrorHandler.handle(error);
        res.status(appError.statusCode).json(ErrorHandler_1.ErrorHandler.formatForFrontend(appError));
    }
});
exports.default = app;
