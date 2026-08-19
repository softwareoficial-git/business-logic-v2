import { Request, Response, NextFunction } from 'express';

// Simulación de almacenamiento de API Keys (esto debe venir de la DB en el futuro)
const PARTNER_DB: Record<string, { tenantId: number, permissions: string[] }> = {
  'TIENDA_KEY_123': { tenantId: 13, permissions: ['stock.list', 'search.suggest', 'sales.register'] },
  'WHATSAPP_KEY_456': { tenantId: 13, permissions: ['search.suggest', 'stock.list'] }
};

export const partnerAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey || !PARTNER_DB[apiKey]) {
    return res.status(403).json({ success: false, message: 'Partner no autorizado o API Key faltante' });
  }
  
  const partner = PARTNER_DB[apiKey];
  
  // Inyectamos el contexto de partner al request
  (req as any).context = {
    tenantId: partner.tenantId,
    role: 'PARTNER',
    plan: 'pro',
    token: 'PARTNER_SYSTEM_TOKEN', // Token interno del sistema
    source: 'PARTNER_API',
    permissions: partner.permissions,
    requestId: req.headers['x-request-id'] || 'partner-req'
  };
  
  next();
};
