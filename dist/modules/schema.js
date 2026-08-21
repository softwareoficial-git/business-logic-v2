"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaModule = void 0;
const Dispatcher_1 = require("../core/Dispatcher");
const DataEngine_1 = require("../core/DataEngine");
class SchemaModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('schema.getFields', {
            name: 'schema.getFields',
            description: 'Obtiene la definición de campos dinámicos',
            requiredRole: 'EMPLEADO'
        }, this.getFields.bind(this));
        Dispatcher_1.dispatcher.register('schema.getFieldsByParent', {
            name: 'schema.getFieldsByParent',
            description: 'Obtiene campos dependientes de un parent_field_id',
            requiredRole: 'EMPLEADO'
        }, this.getFieldsByParent.bind(this));
        Dispatcher_1.dispatcher.register('schema.getValues', {
            name: 'schema.getValues',
            description: 'Obtiene los valores de un campo específico',
            requiredRole: 'EMPLEADO'
        }, this.getValues.bind(this));
        Dispatcher_1.dispatcher.register('schema.ensureValue', {
            name: 'schema.ensureValue',
            description: 'Crea o recupera un valor para un campo (para relaciones)',
            requiredRole: 'EMPLEADO'
        }, this.ensureValue.bind(this));
    }
    async getFields(context) {
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const data = await engine.getNamespace('dynamic_catalog');
        return { success: true, message: 'OK', data: data.fields || {} };
    }
    async getFieldsByParent(context, params) {
        const { parentFieldId } = params;
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const data = await engine.getNamespace('dynamic_catalog');
        const fields = Object.entries(data.fields || {}).map(([id, f]) => ({ id, ...f }));
        const filteredFields = fields.filter((f) => f.parent_field_id === parentFieldId);
        return { success: true, message: 'OK', data: filteredFields };
    }
    async getValues(context, params) {
        const { fieldId } = params;
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const data = await engine.getNamespace('dynamic_catalog');
        const values = Object.entries(data.values || {})
            .filter(([_, v]) => v.field_id === fieldId)
            .map(([id, v]) => ({ id, ...v }));
        return { success: true, message: 'OK', data: values };
    }
    async ensureValue(context, params) {
        const { fieldId, value, parentId } = params;
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const data = await engine.getNamespace('dynamic_catalog');
        // Buscar si existe (insensible a mayúsculas)
        const existingEntry = Object.entries(data.values || {}).find(([_, v]) => v.field_id === fieldId && v.value.toLowerCase() === value.toLowerCase());
        if (existingEntry) {
            const [id, valueObj] = existingEntry;
            return { success: true, message: 'OK', data: { id, ...valueObj } };
        }
        // Crear si no existe
        const id = await engine.createValue(fieldId, value, parentId);
        return { success: true, message: 'Created', data: { id, value, field_id: fieldId, parent_id: parentId } };
    }
}
exports.schemaModule = new SchemaModule();
