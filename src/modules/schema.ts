import { dispatcher } from '../core/Dispatcher';
import { DataEngine } from '../core/DataEngine';
import { ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';

class SchemaModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('schema.getFields', {
      name: 'schema.getFields',
      description: 'Obtiene la definición de campos dinámicos',
      requiredRole: 'EMPLEADO'
    }, this.getFields.bind(this));

    dispatcher.register('schema.getFieldsByParent', {
      name: 'schema.getFieldsByParent',
      description: 'Obtiene campos dependientes de un parent_field_id',
      requiredRole: 'EMPLEADO'
    }, this.getFieldsByParent.bind(this));

    dispatcher.register('schema.getValues', {
      name: 'schema.getValues',
      description: 'Obtiene los valores de un campo específico',
      requiredRole: 'EMPLEADO'
    }, this.getValues.bind(this));

    dispatcher.register('schema.ensureValue', {
      name: 'schema.ensureValue',
      description: 'Crea o recupera un valor para un campo (para relaciones)',
      requiredRole: 'EMPLEADO'
    }, this.ensureValue.bind(this));
  }

  private async getFields(context: RequestContext): Promise<ServiceResponse> {
    const engine = new DataEngine(context.tenantId, context.token);
    const data = await engine.getNamespace('dynamic_catalog');
    return { success: true, message: 'OK', data: data.fields || {} };
  }

  private async getFieldsByParent(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { parentFieldId } = params;
    const engine = new DataEngine(context.tenantId, context.token);
    const data = await engine.getNamespace('dynamic_catalog');
    const fields = Object.entries(data.fields || {}).map(([id, f]: [string, any]) => ({ id, ...f }));
    const filteredFields = fields.filter((f: any) => f.parent_field_id === parentFieldId);
    return { success: true, message: 'OK', data: filteredFields };
  }

  private async getValues(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { fieldId } = params;
    const engine = new DataEngine(context.tenantId, context.token);
    const data = await engine.getNamespace('dynamic_catalog');
    const values = Object.entries(data.values || {})
      .filter(([_, v]: [string, any]) => v.field_id === fieldId)
      .map(([id, v]: [string, any]) => ({ id, ...v }));
    return { success: true, message: 'OK', data: values };
  }

  private async ensureValue(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { fieldId, value, parentId } = params;
    const engine = new DataEngine(context.tenantId, context.token);
    const data = await engine.getNamespace('dynamic_catalog');
    
    // Buscar si existe (insensible a mayúsculas)
    const existingEntry = Object.entries(data.values || {}).find(([_, v]: [string, any]) => 
      v.field_id === fieldId && v.value.toLowerCase() === value.toLowerCase()
    );

    if (existingEntry) {
      const [id, valueObj] = existingEntry;
      return { success: true, message: 'OK', data: { id, ...(valueObj as object) } };
    }

    // Crear si no existe
    const id = await engine.createValue(fieldId, value, parentId);
    return { success: true, message: 'Created', data: { id, value, field_id: fieldId, parent_id: parentId } };
  }
}

export const schemaModule = new SchemaModule();
