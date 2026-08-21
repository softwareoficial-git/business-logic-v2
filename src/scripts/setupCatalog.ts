import { DataEngine } from '../core/DataEngine';

async function setupCatalog() {
  const engine = new DataEngine(12, 'BOOTSTRAP_TOKEN');

  console.log('🏗️ Creando campos dinámicos...');
  const marcaId = await engine.createField('Marca');
  const modeloId = await engine.createField('Modelo');
  const calidadId = await engine.createField('Calidad');
  const precioId = await engine.createField('Precio');
  
  console.log(`✅ Campos creados: Marca(${marcaId}), Modelo(${modeloId}), Calidad(${calidadId}), Precio(${precioId})`);

  console.log('🚚 Cargando marcas...');
  const brands = ['Samsung', 'Motorola', 'Xiaomi', 'Huawei', 'ZTE', 'ALCATEL/TCL', 'Realme', 'Oppo', 'ITEL', 'Infinix'];
  
  for (const b of brands) {
    await engine.createValue(marcaId, b);
  }
  
  console.log('✅ Marcas cargadas correctamente.');
}

setupCatalog().catch(console.error);
