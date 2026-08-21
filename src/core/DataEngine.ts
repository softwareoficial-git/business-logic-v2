import { Pool } from 'pg';

/**
 * DataEngine: Motor de gestión de datos multi-tenant estricto.
 * Garantiza aislamiento total entre clientes.
 */
export class DataEngine {
  private tenantId: number;
  private token: string;
  private dbPool: Pool;

  constructor(tenantId: number, token: string) {
    this.tenantId = tenantId;
    this.token = token;
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL || "postgresql://postgres:aRqmdAfvOPUslSpxquRuRoffmQStDFfh@altaria.proxy.rlwy.net:55759/railway",
    });
  }

  // Aislamiento estricto: todas las consultas se filtran por el tenantId del usuario
  async getNamespace(namespace: string): Promise<any> {
    const res = await this.dbPool.query(
      'SELECT data FROM public.cliente_data_sheets WHERE cliente_id = $1 AND namespace = $2',
      [this.tenantId, namespace]
    );
    return res.rows.length > 0 ? res.rows[0].data : { meta: { next_field_id: 1, next_value_id: 1 } };
  }

  async saveNamespace(namespace: string, data: any): Promise<boolean> {
    const query = `
      INSERT INTO public.cliente_data_sheets (cliente_id, namespace, data, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (cliente_id, namespace) 
      DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP;
    `;
    const res = await this.dbPool.query(query, [this.tenantId, namespace, JSON.stringify(data)]);
    return res.rowCount !== null && res.rowCount > 0;
  }

  // --- MÉTODOS DE NEGOCIO (EL CEREBRO) ---

  async getProductFullData(productCode: string): Promise<any> {
    const [productos, stock, compat] = await Promise.all([
      this.getNamespace('productos'),
      this.getNamespace('stock'),
      this.getNamespace('compat')
    ]);

    const product = productos[productCode];
    if (!product) return null;

    const stockItem = stock[productCode];

    return {
      ...product,
      stock: stockItem ? (stockItem.qty || 0) : 0,
      compatibilidad: (compat.product_to_models && compat.product_to_models[productCode]) || []
    };
  }

  async updateStock(productCode: string, qtyDelta: number): Promise<boolean> {
    return await this.updateItem('stock', productCode, (item) => {
      return { ...item, qty: (item.qty || 0) + qtyDelta };
    });
  }

  async updateItem(namespace: string, id: string, updateFn: (item: any) => any): Promise<boolean> {
    const data = await this.getNamespace(namespace);
    if (!data[id]) throw new Error(`Item ${id} not found in ${namespace}`);
    
    data[id] = updateFn(data[id]);
    return await this.saveNamespace(namespace, data);
  }
}
