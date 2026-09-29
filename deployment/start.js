const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORTS = { INFRA: 3001, LOGIC: 4005, FRONTEND: 8085 };
const DB_URL = 'postgresql://postgres:password@localhost:5432/engine_db';
const ROOT = path.join(__dirname, '..', '..');

const services = [
  { 
    name: 'infrastructure-engine', 
    dir: path.join(ROOT, 'infrastructure-engine'),
    cmd: 'npm', args: ['start'], port: PORTS.INFRA,
    env: { PORT: PORTS.INFRA, DATABASE_URL: DB_URL, ADMIN_SECRET_TOKEN: 'BOOTSTRAP_TOKEN', BUSINESS_LOGIC_URL: `http://localhost:${PORTS.LOGIC}` }
  },
  { 
    name: 'business-logic-v2', 
    dir: path.join(ROOT, 'business-logic-v2'),
    cmd: 'npm', args: ['start'], port: PORTS.LOGIC,
    env: { PORT: PORTS.LOGIC, DATABASE_URL: DB_URL, SYSTEM_TOKEN: 'BOOTSTRAP_TOKEN', INFRA_ENGINE_URL: `http://localhost:${PORTS.INFRA}`, FRONTEND_URL: `http://localhost:${PORTS.FRONTEND}` }
  },
  { 
    name: 'business-frontend-audit', 
    dir: path.join(ROOT, 'business-frontend-audit'),
    cmd: 'npm', args: ['run', 'dev'], port: PORTS.FRONTEND,
    env: { NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.LOGIC}`, PORT: PORTS.FRONTEND }
  }
];

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

async function startSystem() {
  console.log('--- Iniciando sistema diagnóstico robusto ---');

  // 1. Limpieza procesos
  // Proceso de limpieza de nodos eliminado por solicitud del usuario

  // 2. Postgres
  console.log('🐳 Verificando Postgres...');
  try {
    execSync(`docker exec local-postgres pg_isready -U postgres -d engine_db`, { stdio: 'ignore' });
    console.log('✅ Postgres ya está listo.');
  } catch(e) {
    console.log('⏳ Esperando Postgres...');
    for(let i=0; i<15; i++) {
      try { execSync(`docker exec local-postgres pg_isready -U postgres -d engine_db`, { stdio: 'ignore' }); break; }
      catch(err) { if(i===14) process.exit(1); await new Promise(r => setTimeout(r, 2000)); }
    }
  }

  // 3. Arrancar servicios
  for (const svc of services) {
    if (!(await isPortFree(svc.port))) { console.error(`❌ Puerto ${svc.port} ocupado por otro proceso.`); process.exit(1); }
    
    fs.writeFileSync(path.join(svc.dir, '.env'), Object.entries(svc.env).map(([k, v]) => `${k}=${v}`).join('\n'));
    
    // Automatizar build si existe
    const pkg = JSON.parse(fs.readFileSync(path.join(svc.dir, 'package.json'), 'utf8'));
    if (pkg.scripts && pkg.scripts.build) {
      console.log(`🔨 Compilando ${svc.name}...`);
      execSync('npm run build', { cwd: svc.dir, stdio: 'inherit', shell: true });
    }
    
    console.log(`🚀 Lanzando ${svc.name} en ${svc.port}...`);
    const proc = spawn(svc.cmd, svc.args, { cwd: svc.dir, env: { ...process.env, ...svc.env }, shell: true, stdio: 'inherit' });
    proc.on('error', (e) => console.error(`❌ Error en ${svc.name}:`, e));
    
    await new Promise(r => setTimeout(r, 5000));
  }
}

startSystem();
