import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
import { dispatcher } from './core/Dispatcher';
import { infraClient } from './core/InfraClient';
import { ErrorHandler } from './core/ErrorHandler';
import { RequestContext } from './core/RequestContext';
import { csrfMiddleware } from './core/CsrfMiddleware';
import { partnerAuth } from './core/PartnerAuthMiddleware';
import { logger } from './core/Logger'; // Assuming Logger is moved to V2 or we use a simple console
import { billingModule } from './modules/billing';
import { schemaModule } from './modules/schema';
import { productModule } from './modules/product';
import { webModule } from './modules/web';
import { PublicStoreController } from './public-api/controllers/store-controller';

// Forzar inicialización de módulos
billingModule;
schemaModule;
productModule;
webModule;

// ... (después de importaciones)
import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

// Middlewares basicos
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Middleware CSRF condicional: excluir rutas de API
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  csrfMiddleware(req, res, next);
});

// NUEVA RUTA: API PÚBLICA DE PRODUCTOS (Solo lectura)
app.get('/api/public/store/:tenantId/products', PublicStoreController.getProducts);

// Webhook Dinámico por Tenant
app.post('/api/billing/webhook/:tenantId', async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  console.log(`[WEBHOOK] Notificación directa recibida para tenant ${tenantId}`);
  try {
    // Invocamos el handler pasando el tenantId y el body completo para validación
    await billingModule.handlePaymentNotification(parseInt(tenantId), req.body, req.headers);
    res.status(200).send('OK');
  } catch (error) {
    console.error(`[WEBHOOK_ERROR] Tenant: ${tenantId}`, error);
    res.status(500).send('Error');
  }
});

// Endpoint para crear preferencias de pago
app.post('/api/billing/create-payment', async (req: Request, res: Response) => {
  const { plan, amount, tenantId } = req.body;
  
  // Obtenemos el contexto simulado para el usuario (o deberíamos usar el del middleware si fuera una ruta protegida)
  const context = {
      tenantId: parseInt(tenantId),
      role: 'DUEÑO', // Asumimos rol para la prueba
      token: process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN'
  } as RequestContext;

  try {
    const result = await dispatcher.execute('billing.create-preference', { plan, amount }, context);
    res.json(result);
  } catch (error) {
    console.error('[PAYMENT_ERROR]', error);
    res.status(500).json({ success: false, message: 'Error al crear preferencia' });
  }
});

// ... (resto de app.ts)

// Middleware para construir el RequestContext desde las cookies/headers
const contextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[DEBUG] Cookies recibidas:', req.cookies);
  const token = req.cookies.session_token || req.headers.authorization?.toString().replace('Bearer ', '');
  const { cmd } = req.body;
  
  // Permitir login y track-visit sin token
  if (cmd === 'USER:login' || cmd === 'ANALYTICS:track-visit') {
    (req as any).context = {
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
    const profileResult = await dispatcher.execute('USER:get-profile', {}, { 
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

    (req as any).context = {
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
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE_ERROR]', error);
    return res.status(500).json({ success: false, message: 'Authentication service error' });
  }
};

app.get('/health', (req, res) => res.json({ status: 'online', version: '2.0.0' }));

app.post('/register', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    console.error('[REGISTER_ERROR]', error);
    res.status(500).json({ success: false, message: 'Internal registration error' });
  }
});

app.get('/commands', (req, res) => {
  const commands = dispatcher.getAvailableCommands();
  res.json({
    success: true,
    total: commands.length,
    commands: commands
  });
});

app.post('/execute', contextMiddleware, async (req: Request, res: Response) => {
  console.log('[DEBUG] /execute body:', req.body);
  const { cmd, params } = req.body;
  const context = (req as any).context as RequestContext;

  if (!cmd) {
    return res.status(400).json({ success: false, message: 'Missing cmd parameter' });
  }

  try {
    const result = await dispatcher.execute(cmd, params || {}, context);
    
    if (!result.success) {
      const appError = ErrorHandler.handle(result);
      return res.status(appError.statusCode).json(ErrorHandler.formatForFrontend(appError));
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
  } catch (error: any) {
    const appError = ErrorHandler.handle(error);
    res.status(appError.statusCode).json(ErrorHandler.formatForFrontend(appError));
  }
});

// Nueva ruta para partners externos
app.post('/api/partner/execute', partnerAuth, async (req: Request, res: Response) => {
  const { cmd, params } = req.body;
  const context = (req as any).context as RequestContext;

  if (!context.permissions || !context.permissions.includes(cmd)) {
    return res.status(403).json({ success: false, message: 'Permiso denegado para este comando' });
  }

  try {
    const result = await dispatcher.execute(cmd, params || {}, context);
    if (!result.success) {
      const appError = ErrorHandler.handle(result);
      return res.status(appError.statusCode).json(ErrorHandler.formatForFrontend(appError));
    }
    res.json(result);
  } catch (error: any) {
    const appError = ErrorHandler.handle(error);
    res.status(appError.statusCode).json(ErrorHandler.formatForFrontend(appError));
  }
});

export default app;
