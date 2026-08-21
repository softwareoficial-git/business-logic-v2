import { Request, Response } from 'express';
import { PublicProductService } from '../product-service';
import { TenantService } from '../tenant-service';
import { DataEngine } from '../../core/DataEngine';

export class PublicStoreController {
  
  static async getProductsByName(req: Request, res: Response) {
    try {
      const { tenantName } = req.params;
      
      const tenantId = await TenantService.getTenantIdByName(tenantName);
      if (!tenantId) {
        return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
      }
      
      const filters = req.query;
      
      const [products, settings] = await Promise.all([
        PublicProductService.getProducts(tenantId.toString(), filters),
        new DataEngine(tenantId, process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN').getNamespace('settings')
      ]);
      
      res.json({
        success: true,
        tenantName,
        tenantId,
        count: products.length,
        settings,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async checkStoreNameAvailability(req: Request, res: Response) {
    try {
      const { storeNameSlug } = req.params;
      const tenantId = await TenantService.getTenantIdByName(storeNameSlug);
      
      res.json({
        success: true,
        isAvailable: tenantId === null,
        message: tenantId === null ? 'Nombre de tienda disponible' : 'Nombre de tienda ya en uso'
      });
    } catch (error: any) {
      console.error('Error checking store name availability:', error);
      res.status(500).json({ success: false, isAvailable: false, message: 'Error interno del servidor' });
    }
  }

  static async getProducts(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      const filters = req.query;
      
      const systemToken = process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN';
      const engine = new DataEngine(parseInt(tenantId), systemToken);
      
      const [products, tenantName, settings] = await Promise.all([
        PublicProductService.getProducts(tenantId, filters),
        TenantService.getTenantName(tenantId),
        engine.getNamespace('settings')
      ]);
      
      res.json({
        success: true,
        tenantName,
        count: products.length,
        settings,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
