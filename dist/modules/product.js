"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productModule = void 0;
const Dispatcher_1 = require("../core/Dispatcher");
const DataEngine_1 = require("../core/DataEngine");
class ProductModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('product.get', {
            name: 'product.get',
            description: 'Obtiene la información completa de un producto unificada (datos + stock + compat)',
            requiredRole: 'EMPLEADO'
        }, this.getProduct.bind(this));
        Dispatcher_1.dispatcher.register('product.search', {
            name: 'product.search',
            description: 'Búsqueda avanzada por marca, calidad, marco o nombre',
            requiredRole: 'EMPLEADO'
        }, this.searchProducts.bind(this));
        Dispatcher_1.dispatcher.register('product.add', {
            name: 'product.add',
            description: 'Crea un nuevo producto en el catálogo dinámico',
            requiredRole: 'EMPLEADO'
        }, this.addProduct.bind(this));
    }
    async addProduct(context, params) {
        const { code, name, categoryLabel, price, qty, dynamicAttributes = {} } = params;
        if (!code || !name || !categoryLabel || price === undefined || qty === undefined) {
            return {
                success: false,
                message: 'Faltan datos obligatorios: code, name, categoryLabel, price y qty'
            };
        }
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        // Resolver category_id (campo padre principal)
        const categoryId = await engine.ensureValueId('Categoría', categoryLabel);
        // Resolver atributos dinámicos y sus valores a IDs
        const resolvedAttributes = {};
        const attributeValueIds = []; // Lista plana de todos los IDs de atributos para búsqueda rápida
        for (const fieldLabel in dynamicAttributes) {
            const values = Array.isArray(dynamicAttributes[fieldLabel])
                ? dynamicAttributes[fieldLabel]
                : [dynamicAttributes[fieldLabel]];
            const fieldAttributeIds = [];
            for (const valueLabel of values) {
                // Asumimos 'Marca' es el padre de 'Modelo' y 'Ingrediente' puede tener 'Marca' como padre lógico
                // Esto requeriría una lógica más compleja de parentesco si se tienen múltiples niveles
                const parentValueLabel = fieldLabel === 'Modelo' ? (dynamicAttributes['Marca'] || categoryLabel) : undefined;
                const valueId = await engine.ensureValueId(fieldLabel, valueLabel, parentValueLabel);
                fieldAttributeIds.push(valueId);
                attributeValueIds.push(valueId);
            }
            resolvedAttributes[fieldLabel] = fieldAttributeIds;
        }
        const productos = await engine.getNamespace('productos');
        productos[code] = {
            code,
            name,
            price,
            qty,
            category_id: categoryId,
            attributes: resolvedAttributes, // Atributos resueltos por campo (ej. Marca: [val_samsung])
            attribute_value_ids: attributeValueIds // Todos los IDs de atributos para búsqueda eficiente
        };
        await engine.saveNamespace('productos', productos);
        return { success: true, message: 'Producto creado exitosamente' };
    }
    async getProduct(context, params) {
        const { productCode } = params;
        if (!productCode)
            return { success: false, message: 'productCode es requerido' };
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const product = await engine.getProductFullData(productCode); // Llama al método directamente
        if (!product) {
            return { success: false, message: 'Producto no encontrado' };
        }
        // Opcional: Enriquecer el producto con los nombres de los atributos
        const catalog = await engine.getNamespace('dynamic_catalog');
        const enrichedAttributes = {};
        if (product.attributes) {
            for (const fieldLabel in product.attributes) {
                const valueIds = product.attributes[fieldLabel];
                if (Array.isArray(valueIds)) {
                    enrichedAttributes[fieldLabel] = valueIds.map(valId => catalog.values?.[valId]?.value || valId);
                }
                else {
                    enrichedAttributes[fieldLabel] = catalog.values?.[valueIds]?.value || valueIds;
                }
            }
        }
        const categoryName = catalog.values?.[product.category_id]?.value || product.category_id;
        return {
            success: true,
            message: 'OK',
            data: { ...product, category_name: categoryName, enrichedAttributes }
        };
    }
    async searchProducts(context, params) {
        const { query = '' } = params;
        const q = query.toLowerCase();
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const productos = await engine.getNamespace('productos');
        const catalog = await engine.getNamespace('dynamic_catalog');
        const results = Object.values(productos).filter((p) => {
            // Búsqueda por nombre del producto
            if (p.name?.toLowerCase().includes(q))
                return true;
            // Búsqueda por cualquier atributo dinámico (ID o valor)
            if ((p.attribute_value_ids || []).some((valId) => {
                const valueObj = catalog.values?.[valId];
                return valueObj?.value?.toLowerCase().includes(q);
            }))
                return true;
            // Si no se encuentra en el nombre ni en los atributos, no hay coincidencia
            return false;
        });
        // Enriquecer resultados con nombres de atributos para el frontend
        const enrichedResults = results.map((p) => {
            const enrichedAttributes = {};
            for (const fieldLabel in p.attributes) {
                const valueIds = p.attributes[fieldLabel];
                if (Array.isArray(valueIds)) {
                    enrichedAttributes[fieldLabel] = valueIds.map(valId => catalog.values?.[valId]?.value || valId);
                }
                else {
                    enrichedAttributes[fieldLabel] = catalog.values?.[valueIds]?.value || valueIds;
                }
            }
            // Resolver el nombre de la categoría también
            const categoryName = catalog.values?.[p.category_id]?.value || p.category_id;
            return { ...p, category_name: categoryName, enrichedAttributes };
        });
        return { success: true, message: 'OK', data: enrichedResults };
    }
}
exports.productModule = new ProductModule();
