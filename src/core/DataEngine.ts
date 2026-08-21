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

  // Métodos para Schema dinámico
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

  async resolveFieldId(fieldLabel: string): Promise<string | undefined> {
    const data = await this.getNamespace('dynamic_catalog');
    const field = Object.entries(data.fields || {}).find(([id, f]: [string, any]) => f.label === fieldLabel);
    return field ? field[0] : undefined;
  }

  async ensureValueId(fieldLabel: string, valueLabel: string, parentValueLabel?: string): Promise<string> {
    const data = await this.getNamespace('dynamic_catalog');
    const fieldId = await this.resolveFieldId(fieldLabel);

    if (!fieldId) {
      throw new Error(`Field with label "${fieldLabel}" not found. Please create it first.`);
    }

    let parentId: string | undefined;
    if (parentValueLabel) {
      const parentFieldEntry = Object.entries(data.fields || {}).find(([id, f]: [string, any]) => f.label === fieldLabel && f.parent_field_id);
      if (parentFieldEntry) {
        const parentFieldIdFromEntry = (parentFieldEntry[1] as any).parent_field_id;
        const parentFieldLabel = (data.fields[parentFieldIdFromEntry] as any)?.label;
        const resolvedParentFieldId = await this.resolveFieldId(parentFieldLabel);
        
        const parentValueEntry = Object.entries(data.values || {}).find(([id, v]: [string, any]) => 
          resolvedParentFieldId && v.field_id === resolvedParentFieldId && v.value === parentValueLabel
        );
        if (!parentValueEntry) throw new Error(`Parent value "${parentValueLabel}" not found for field "${parentFieldLabel}".`);
        parentId = parentValueEntry[0];
      }
    }

    const existingValue = Object.entries(data.values || {}).find(([id, v]: [string, any]) => 
      v.field_id === fieldId && v.value === valueLabel && (parentId ? v.parent_id === parentId : !v.parent_id)
    );

    if (existingValue) {
      return existingValue[0];
    }

    // Create new value if not found
    const valueId = `val_${data.meta.next_value_id}`;
    if (!data.values) data.values = {};
    data.values[valueId] = { field_id: fieldId, value: valueLabel, parent_id: parentId };
    data.meta.next_value_id++;
    
    await this.saveNamespace('dynamic_catalog', data);
    return valueId;
  }

  // --- PRODUCTOS Y STOCK ---

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
