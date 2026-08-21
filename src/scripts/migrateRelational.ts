import { DataEngine } from '../core/DataEngine';
import * as fs from 'fs';
import * as path from 'path';

async function migrateRelational() {
  const engine = new DataEngine(12, 'BOOTSTRAP_TOKEN');
  const csvPath = path.join(__dirname, '../../precios_redmovil.csv');
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');

  const brands: Record<string, number> = {};
  const models: Record<string, { id: number; brand_id: number }> = {};
  const products: any = {};
  const stock: any = {};

  let brandCounter = 1;
  let modelCounter = 1;

  let currentBrandName = '';

  // Pass 1: Build Masters
  for (const line of lines) {
    if (!line.trim()) continue;
    const [rawName, rawPrice] = line.split(',');
    if (rawName && !rawPrice) {
      currentBrandName = rawName.trim();
      if (!brands[currentBrandName]) brands[currentBrandName] = brandCounter++;
      continue;
    }

    const modelsRaw = rawName.split('/')[0].trim();
    if (!models[modelsRaw]) {
      models[modelsRaw] = { id: modelCounter++, brand_id: brands[currentBrandName] };
    }
  }

  // Pass 2: Build Products
  for (const line of lines) {
    if (!line.trim()) continue;
    const [rawName, rawPrice] = line.split(',');
    if (rawName && !rawPrice) {
      currentBrandName = rawName.trim();
      continue;
    }

    const price = parseInt(rawPrice) || 0;
    const name = rawName.trim();
    const code = name.toLowerCase().replace(/\s+/g, '_');
    
    // Split compatibility by / and map to model IDs
    const compatParts = rawName.split('/').map(p => p.trim());
    const modelIds = compatParts.map(part => models[part]?.id).filter(Boolean);

    products[code] = {
      code,
      name,
      model_ids: modelIds,
      metadata: {
        calidad: name.match(/(incell|AAA|Original|SERVICE PACK|oled|VEZR)/i)?.[0] || 'Standard',
        marco: name.match(/(c\/marco|c\/m)/i) ? 'con marco' : 'sin marco'
      }
    };
    stock[code] = { code, qty: 10 };
  }

  // Save everything
  await engine.saveNamespace('brands_master', brands);
  await engine.saveNamespace('models_master', models);
  await engine.saveNamespace('productos', products);
  await engine.saveNamespace('stock', stock);

  console.log('✅ Base de datos relacional establecida.');
}

migrateRelational().catch(console.error);
