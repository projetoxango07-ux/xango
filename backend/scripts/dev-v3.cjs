/**
 * Inicia a API local apontando SOMENTE ao banco isolado xango_v3_dev.
 * Uso na pasta backend: node scripts/dev-v3.cjs
 * Nao edita .env e recusa destinos remotos.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const raiz = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
const linha = env.split(/\r?\n/).find((x) => /^\s*DATABASE_URL\s*=/.test(x));
if (!linha) throw new Error('DATABASE_URL nao encontrada em backend/.env.');
const original = linha.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '');
const url = new URL(original);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/xango') {
  throw new Error('Conexao nao e localhost/xango. A inicializacao V3 foi bloqueada.');
}
url.pathname = '/xango_v3_dev';
console.log('Iniciando API V3 no banco isolado: ' + url.hostname + '/' + url.pathname.slice(1));
const proc = spawn('npm', ['run', 'dev'], {
  cwd: raiz,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: url.toString() },
});
proc.on('error', (erro) => { console.error(erro); process.exitCode = 1; });
proc.on('exit', (codigo) => { process.exitCode = codigo ?? 1; });
