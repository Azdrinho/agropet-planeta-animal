// Lê o arquivo .env (se existir) para process.env. Formato: CHAVE=valor, uma por linha.
// Na Vercel não há .env: as variáveis vêm das configurações do projeto.
const path = require('node:path');
const fs = require('node:fs');

const arq = path.join(__dirname, '..', '.env');
if (fs.existsSync(arq)) {
  for (const linha of fs.readFileSync(arq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
