import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';
import { dispatcher } from './core/Dispatcher';
import { ErrorHandler } from './core/ErrorHandler';
import { RequestContext } from './core/RequestContext';
import { logger } from './core/Logger'; // Assuming Logger is moved to V2 or we use a simple console

// Middlewares basicos
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Middleware para construir el RequestContext desde las cookies/headers
const contextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.session_token || req.headers.authorization?.toString().replace('Bearer ', '');
  const { cmd } = req.body;
  
  // Permitir login sin token
  if (cmd === 'USER:login') {
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
  } catch (error) {
    console.error('[AUTH_MIDDLEWARE_ERROR]', error);
    return res.status(500).json({ success: false, message: 'Authentication service error' });
  }
};

app.get('/health', (req, res) => res.json({ status: 'online', version: '2.0.0' }));

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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
      
      // Remove token from the JSON response so the frontend never sees it
      const { token, ...restData } = result.data;
      result.data = { ...restData, sessionEstablished: true };
    }
    // --------------------------------

    res.json(result);
  } catch (error: any) {
    const appError = ErrorHandler.handle(error);
    res.status(appError.statusCode).json(ErrorHandler.formatForFrontend(appError));
  }
});

export default app;
