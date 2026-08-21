import { DataEngine } from '../core/DataEngine';
import * as fs from 'fs';
import * as path from 'path';

async function importStock() {
  const engine = new DataEngine(12, 'BOOTSTRAP_TOKEN'); // Cliente RedMovil (ID 12)
  const csvPath = path.join(__dirname, '../../precios_redmovil.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');

  const productos: any = {};
  const stock: any = {};
  const compat: any = { product_to_models: {}, model_to_products: {} };

  let currentBrand = '';

  for (const line of lines) {
    if (!line.trim()) continue;

    const [rawName, rawPrice, ...rest] = line.split(',');
    
    // Detectar Marca (encabezado)
    if (rawName && !rawPrice) {
      currentBrand = rawName.trim();
      continue;
    }

    // Normalizar Producto
    const price = parseInt(rawPrice) || 0;
    const name = rawName.trim();
    const code = name.toLowerCase().replace(/\s+/g, '_');

    // Extraer atributos
    const qualityMatch = name.match(/(incell|AAA|Original|SERVICE PACK|oled|VEZR)/i);
    const frameMatch = name.match(/(c\/marco|c\/m)/i);

    const product = {
      code,
      name,
      category: currentBrand,
      price,
      metadata: {
        marca: currentBrand,
        calidad: qualityMatch ? qualityMatch[0] : 'Standard',
        marco: frameMatch ? 'con marco' : 'sin marco'
      }
    };

    productos[code] = product;
    stock[code] = { code, qty: 10 }; // Stock inicial por defecto

    // Desglosar compatibilidad (si contiene '/')
    const models = name.split('/')[0].split(' '); // Simplificación para demo
    compat.product_to_models[code] = models;
    models.forEach(m => {
        if(!compat.model_to_products[m]) compat.model_to_products[m] = [];
        compat.model_to_products[m].push(code);
    });
  }

  await engine.saveNamespace('productos', productos);
  await engine.saveNamespace('stock', stock);
  await engine.saveNamespace('compat', compat);

  console.log('✅ Datos cargados correctamente.');
}

importStock().catch(console.error);
