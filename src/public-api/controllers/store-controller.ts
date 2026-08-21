import { Request, Response } from 'express';
import { PublicProductService } from '../product-service';

export class PublicStoreController {
  static async getProducts(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      
      // Extraer filtros de la query string (ej: ?category=hamburguesas&metadata.tipo=picante)
      const filters = req.query;
      
      const products = await PublicProductService.getProducts(tenantId, filters);
      
      res.json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
