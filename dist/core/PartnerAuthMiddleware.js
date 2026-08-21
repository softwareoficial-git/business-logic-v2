"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partnerAuth = void 0;
// Simulación de almacenamiento de API Keys (esto debe venir de la DB en el futuro)
const PARTNER_DB = {
    'TIENDA_KEY_123': { tenantId: 13, permissions: ['stock.list', 'search.suggest', 'sales.register'] },
    'WHATSAPP_KEY_456': { tenantId: 13, permissions: ['search.suggest', 'stock.list'] }
};
const partnerAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const requestedTenantId = parseInt(req.headers['x-tenant-id']) || req.body?.params?.tenantId;
    if (!apiKey || !PARTNER_DB[apiKey]) {
        return res.status(403).json({ success: false, message: 'Partner no autorizado o API Key faltante' });
    }
    const partner = PARTNER_DB[apiKey];
    // Si la clave tiene permiso global, permitimos especificar el tenant, sino forzamos el del partner
    const tenantId = (partner.permissions.includes('admin.global') && requestedTenantId)
        ? requestedTenantId
        : partner.tenantId;
    // Inyectamos el contexto de partner al request
    req.context = {
        tenantId: tenantId,
        role: 'PARTNER',
        plan: 'pro',
        token: 'PARTNER_SYSTEM_TOKEN',
        source: 'PARTNER_API',
        permissions: partner.permissions,
        requestId: req.headers['x-request-id'] || 'partner-req'
    };
    next();
};
exports.partnerAuth = partnerAuth;
