import { DataEngine } from '../core/DataEngine';

async function loadProducts() {
  const engine = new DataEngine(12, 'BOOTSTRAP_TOKEN');
  
  // 1. Obtener IDs dinámicos
  const catalog = await engine.getNamespace('dynamic_catalog');
  const catMap: Record<string, string> = {};
  const modelMap: Record<string, string> = {};

  for (const [id, val] of Object.entries(catalog.values)) {
    const v = val as any;
    if (v.field_id === 'field_5') catMap[v.value] = id; // Categoría
    if (v.field_id === 'field_2') modelMap[v.value] = id; // Modelo
  }

  // 2. Definir productos
  const products = {
    'pantalla_j1': {
      name: 'Pantalla J1',
      category_id: catMap['Modulos'],
      model_ids: [modelMap['J1']],
      metadata: { calidad: 'incell', marco: 'con marco' }
    },
    'bateria_j1': {
      name: 'Batería J1',
      category_id: catMap['Baterias'],
      model_ids: [modelMap['J1']],
      metadata: { calidad: 'Original', marco: 'sin marco' }
    },
    'pantalla_g8': {
      name: 'Pantalla G8',
      category_id: catMap['Modulos'],
      model_ids: [modelMap['G8']],
      metadata: { calidad: 'incell', marco: 'sin marco' }
    },
    'bateria_e7': {
      name: 'Batería E7',
      category_id: catMap['Baterias'],
      model_ids: [modelMap['E7']],
      metadata: { calidad: 'Original', marco: 'sin marco' }
    }
  };

  // 3. Cargar en namespace 'productos'
  await engine.saveNamespace('productos', products);
  console.log('✅ Productos cargados y relacionados correctamente.');
}

loadProducts().catch(console.error);
