"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicStoreController = void 0;
const product_service_1 = require("../product-service");
const tenant_service_1 = require("../tenant-service");
const DataEngine_1 = require("../../core/DataEngine");
class PublicStoreController {
    static async getProductsByName(req, res) {
        try {
            const { tenantName } = req.params;
            const tenantId = await tenant_service_1.TenantService.getTenantIdByName(tenantName);
            if (!tenantId) {
                return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
            }
            const filters = req.query;
            const [products, settings] = await Promise.all([
                product_service_1.PublicProductService.getProducts(tenantId.toString(), filters),
                new DataEngine_1.DataEngine(tenantId, process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN').getNamespace('settings')
            ]);
            res.json({
                success: true,
                tenantName,
                tenantId,
                count: products.length,
                settings,
                data: products
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async checkStoreNameAvailability(req, res) {
        try {
            const { storeNameSlug } = req.params;
            const tenantId = await tenant_service_1.TenantService.getTenantIdByName(storeNameSlug);
            res.json({
                success: true,
                isAvailable: tenantId === null,
                message: tenantId === null ? 'Nombre de tienda disponible' : 'Nombre de tienda ya en uso'
            });
        }
        catch (error) {
            console.error('Error checking store name availability:', error);
            res.status(500).json({ success: false, isAvailable: false, message: 'Error interno del servidor' });
        }
    }
    static async getProducts(req, res) {
        try {
            const { tenantId } = req.params;
            const filters = req.query;
            const systemToken = process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN';
            const engine = new DataEngine_1.DataEngine(parseInt(tenantId), systemToken);
            const [products, tenantName, settings] = await Promise.all([
                product_service_1.PublicProductService.getProducts(tenantId, filters),
                tenant_service_1.TenantService.getTenantName(tenantId),
                engine.getNamespace('settings')
            ]);
            res.json({
                success: true,
                tenantName,
                count: products.length,
                settings,
                data: products
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.PublicStoreController = PublicStoreController;
