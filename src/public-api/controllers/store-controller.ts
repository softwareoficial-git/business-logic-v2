import { Request, Response } from 'express';
import { PublicProductService } from '../product-service';
import { TenantService } from '../tenant-service';

export class PublicStoreController {
  // Nueva ruta: Resolución por nombre (slug)
  static async getProductsByName(req: Request, res: Response) {
    try {
      const { tenantName } = req.params;
      
      const tenantId = await TenantService.getTenantIdByName(tenantName);
      if (!tenantId) {
        return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
      }
      
      const filters = req.query;
      
      const products = await PublicProductService.getProducts(tenantId.toString(), filters);
      
      res.json({
        success: true,
        tenantName,
        tenantId,
        count: products.length,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Endpoint para verificar la disponibilidad de un nombre de tienda (slug)
  static async checkStoreNameAvailability(req: Request, res: Response) {
    try {
      const { storeNameSlug } = req.params;
      const tenantId = await TenantService.getTenantIdByName(storeNameSlug);
      
      res.json({
        success: true,
        isAvailable: tenantId === null, // Si no encuentra un ID, está disponible
        message: tenantId === null ? 'Nombre de tienda disponible' : 'Nombre de tienda ya en uso'
      });
    } catch (error: any) {
      console.error('Error checking store name availability:', error);
      res.status(500).json({ success: false, isAvailable: false, message: 'Error interno del servidor' });
    }
  }

  // Mantenemos la ruta original por si se necesita
  static async getProducts(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const filters = req.query;
      
      const [products, tenantName] = await Promise.all([
        PublicProductService.getProducts(tenantId, filters),
        TenantService.getTenantName(tenantId)
      ]);
      
      res.json({
        success: true,
        tenantName,
        count: products.length,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
