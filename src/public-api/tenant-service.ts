import { Pool } from 'pg';

export class TenantService {
  private static dbPool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:aRqmdAfvOPUslSpxquRuRoffmQStDFfh@altaria.proxy.rlwy.net:55759/railway",
  });

  static async getTenantName(tenantId: string): Promise<string> {
    try {
      const res = await this.dbPool.query(
        'SELECT nombre FROM public.clientes WHERE id = $1',
        [parseInt(tenantId)]
      );
      return res.rows.length > 0 ? res.rows[0].nombre : `Tienda ${tenantId}`;
    } catch (error) {
      console.error('Error fetching tenant name:', error);
      return `Tienda ${tenantId}`;
    }
  }
}
