import { Pool } from 'pg';

/**
 * DataEngine: Motor de gestión de datos multi-namespace.
 * Centraliza el acceso a las hojas de datos (jsonb) en cliente_data_sheets.
 * Ahora con soporte para IDs dinámicos y relaciones padre-hijo.
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

  async createField(label: string, parentFieldId?: string): Promise<string> {
    const data = await this.getNamespace('dynamic_catalog');
    if (!data.meta) data.meta = { next_field_id: 1, next_value_id: 1 };
    
    const fieldId = `field_${data.meta.next_field_id}`;
    if (!data.fields) data.fields = {};
    data.fields[fieldId] = { label, is_relational: true, parent_field_id: parentFieldId };
    data.meta.next_field_id++;
    
    await this.saveNamespace('dynamic_catalog', data);
    return fieldId;
  }

  async createValue(fieldId: string, value: string, parentId?: string): Promise<string> {
    const data = await this.getNamespace('dynamic_catalog');
    if (!data.meta) data.meta = { next_field_id: 1, next_value_id: 1 };
    
    const valueId = `val_${data.meta.next_value_id}`;
    if (!data.values) data.values = {};
    data.values[valueId] = { field_id: fieldId, value, parent_id: parentId };
    data.meta.next_value_id++;
    
    await this.saveNamespace('dynamic_catalog', data);
    return valueId;
  }

  /**
   * Resolver: Obtiene un producto con sus datos de stock y compatibilidad unidos.
   * Emula un "JOIN" de base de datos relacional sobre los namespaces.
   */
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
}
