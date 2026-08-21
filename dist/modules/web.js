"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webModule = void 0;
const Dispatcher_1 = require("../core/Dispatcher");
const DataEngine_1 = require("../core/DataEngine");
class WebModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('web.search', {
            name: 'web.search',
            description: 'Búsqueda predictiva y relacional para tiendas web/WhatsApp',
            requiredRole: 'EMPLEADO' // Ajustar según permisos públicos
        }, this.search.bind(this));
    }
    async search(context, params) {
        const { query = '' } = params;
        const q = query.toLowerCase();
        if (q.length < 2)
            return { success: true, message: 'OK', data: [] };
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const [catalog, productos] = await Promise.all([
            engine.getNamespace('dynamic_catalog'),
            engine.getNamespace('productos')
        ]);
        const results = [];
        // 1. Sugerencias de Valores Dinámicos (Marcas, Modelos, Categorías)
        Object.entries(catalog.values || {}).forEach(([id, val]) => {
            if (val.value.toLowerCase().includes(q)) {
                results.push({
                    type: 'suggestion',
                    label: val.value,
                    ref_id: id,
                    field: catalog.fields[val.field_id]?.label
                });
            }
        });
        // 2. Sugerencias de Productos (con unión relacional)
        Object.entries(productos).forEach(([code, p]) => {
            if (p.name.toLowerCase().includes(q)) {
                results.push({
                    type: 'product',
                    label: p.name,
                    ref_id: code,
                    price: p.price
                });
            }
        });
        return { success: true, message: 'OK', data: results.slice(0, 10) };
    }
}
exports.webModule = new WebModule();
