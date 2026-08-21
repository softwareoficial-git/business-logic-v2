import { DataEngine } from '../core/DataEngine';

async function addCategories() {
  const engine = new DataEngine(12, 'BOOTSTRAP_TOKEN');

  console.log('🏗️ Creando campo Categoría...');
  const catId = await engine.createField('Categoría');
  
  console.log(`✅ Campo creado: Categoría(${catId})`);

  console.log('🚚 Cargando valores de categoría...');
  await engine.createValue(catId, 'Modulos');
  await engine.createValue(catId, 'Baterias');
  
  console.log('✅ Categorías cargadas correctamente.');
}

addCategories().catch(console.error);
