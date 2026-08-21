"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicStoreController = void 0;
const product_service_1 = require("../product-service");
class PublicStoreController {
    static async getProducts(req, res) {
        try {
            const { tenantId } = req.params;
            // Extraer filtros de la query string (ej: ?category=hamburguesas&metadata.tipo=picante)
            const filters = req.query;
            const products = await product_service_1.PublicProductService.getProducts(tenantId, filters);
            res.json({
                success: true,
                count: products.length,
                data: products
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.PublicStoreController = PublicStoreController;
