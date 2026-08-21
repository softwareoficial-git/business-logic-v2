"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantService = void 0;
const pg_1 = require("pg");
class TenantService {
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
}
exports.TenantService = TenantService;
TenantService.dbPool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:aRqmdAfvOPUslSpxquRuRoffmQStDFfh@altaria.proxy.rlwy.net:55759/railway",
});
