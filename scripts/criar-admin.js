// Cria (ou redefine a senha de) um acesso ao painel. Não existe senha padrão.
// Uso: npm run criar-admin -- email@loja.com "Senha forte 123" "Nome"
const { db } = require('../src/db');
const { hashSenha, senhaFraca } = require('../src/auth');

const [email, senha, nome = ''] = process.argv.slice(2);
if (!email || !senha) {
  console.log('Uso: npm run criar-admin -- email@loja.com "senha com 10+ caracteres" "Nome"');
  process.exit(1);
}
const fraca = senhaFraca(senha);
if (fraca) { console.error(fraca); process.exit(1); }
const existe = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
if (existe) {
  db.prepare('UPDATE users SET senha_hash = ?, tentativas = 0, bloqueado_ate = NULL WHERE id = ?').run(hashSenha(senha), existe.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existe.id);
  console.log(`Senha de ${email} redefinida.`);
} else {
  db.prepare('INSERT INTO users (email, nome, senha_hash) VALUES (?, ?, ?)').run(email.toLowerCase(), nome, hashSenha(senha));
  console.log(`Acesso criado para ${email}. Entre em /admin.`);
}
