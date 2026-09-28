const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración de Puertos (Unconventional)
const PORTS = {
  INFRA: '3001',
  LOGIC: '4005',
  FRONTEND: '8085'
};

const DB_USER = 'postgres';
const DB_PASS = 'password';
const DB_NAME = 'engine_db';
const DATABASE_URL = `postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}`;

const services = [
  { 
    name: 'infrastructure-engine', 
    cmd: 'npm', args: ['start'], 
    port: PORTS.INFRA,
    env: { PORT: PORTS.INFRA, DATABASE_URL: DATABASE_URL, ADMIN_SECRET_TOKEN: 'BOOTSTRAP_TOKEN', BUSINESS_LOGIC_URL: `http://localhost:${PORTS.LOGIC}` }
  },
  { 
    name: 'business-logic-v2', 
    cmd: 'npm', args: ['start'], 
    port: PORTS.LOGIC,
    env: { PORT: PORTS.LOGIC, DATABASE_URL: DATABASE_URL, SYSTEM_TOKEN: 'BOOTSTRAP_TOKEN', INFRA_ENGINE_URL: `http://localhost:${PORTS.INFRA}`, FRONTEND_URL: `http://localhost:${PORTS.FRONTEND}` }
  },
  { 
    name: 'business-frontend-audit', 
    cmd: 'npm', args: ['run', 'dev'], 
    port: PORTS.FRONTEND,
    env: { NEXT_PUBLIC_API_URL: `http://localhost:${PORTS.LOGIC}`, PORT: PORTS.FRONTEND }
  }
];

function runAsync(cmd, args, cwd, env) {
  return spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: true, stdio: 'inherit' });
}

async function startSystem() {
  console.log('--- Iniciando sistema completo (Puertos: 3001, 4005, 8085) ---');

  // 1. Limpieza total de procesos en puertos
  console.log('🧹 Limpiando puertos...');
  try { execSync(`fuser -k ${PORTS.INFRA}/tcp ${PORTS.LOGIC}/tcp ${PORTS.FRONTEND}/tcp || true`, { stdio: 'ignore' }); } catch(e) {}

  // 2. Postgres
  console.log('🐳 Iniciando Postgres...');
  execSync('docker stop pg-db || true && docker rm pg-db || true', { stdio: 'ignore' });
  execSync(`docker run -d --name pg-db -p 5432:5432 -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} postgres:16-alpine`, { stdio: 'ignore' });
  
  await new Promise(r => setTimeout(r, 5000));

  // 3. Arrancar servicios
  for (const svc of services) {
    const dir = path.join(__dirname, '..', '..', svc.name);
    
    // Configurar .env
    const envContent = Object.entries(svc.env).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(path.join(dir, '.env'), envContent);
    
    console.log(`🚀 Lanzando ${svc.name} en puerto ${svc.port}...`);
    runAsync(svc.cmd, svc.args, dir, svc.env);
    
    await new Promise(r => setTimeout(r, 8000));
  }
  
  console.log('✅ Sistema lanzado. Monitoreando...');
}

startSystem();
