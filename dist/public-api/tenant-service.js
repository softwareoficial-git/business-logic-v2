"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const pg_1 = require("pg");
class TenantService {
    static async getTenantConfig(tenantId) {
        try {
            const res = await this.dbPool.query('SELECT public_config FROM public.clientes WHERE id = $1', [parseInt(tenantId)]);
            return res.rows.length > 0 ? res.rows[0].public_config : null;
        }
        catch (error) {
            console.error('Error fetching tenant config:', error);
            return null;
        }
    }
    static async getTenantName(tenantId) {
        try {
            const res = await this.dbPool.query('SELECT nombre FROM public.clientes WHERE id = $1', [parseInt(tenantId)]);
            return res.rows.length > 0 ? res.rows[0].nombre : `Tienda ${tenantId}`;
        }
        catch (error) {
            console.error('Error fetching tenant name:', error);
            return `Tienda ${tenantId}`;
        }
    }
    static async getTenantIdByName(name) {
        try {
            const res = await this.dbPool.query('SELECT id FROM public.clientes WHERE nombre = $1', [name]);
            return res.rows.length > 0 ? res.rows[0].id : null;
        }
        catch (error) {
            console.error('Error resolving tenant ID by name:', error);
            return null;
        }
    }
}
exports.TenantService = TenantService;
TenantService.dbPool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:aRqmdAfvOPUslSpxquRuRoffmQStDFfh@altaria.proxy.rlwy.net:55759/railway",
});
