import { DataEngine } from '../core/DataEngine';
import { randomUUID } from 'crypto';

async function addCodigoId() {
  const engine = new DataEngine(12, 'BOOTSTRAP_TOKEN');
  const productos = await engine.getNamespace('productos');

  let updatedCount = 0;
  for (const key in productos) {
    if (!productos[key].codigo_id) {
      productos[key].codigo_id = randomUUID();
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    await engine.saveNamespace('productos', productos);
    console.log(`✅ ${updatedCount} productos actualizados con un nuevo codigo_id.`);
  } else {
    console.log('ℹ️ Todos los productos ya tenían un codigo_id.');
  }
}

addCodigoId().catch(console.error);
