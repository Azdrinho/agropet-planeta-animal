// Cria (ou redefine a senha de) um acesso ao painel. Não existe senha padrão.
// Uso: npm run criar-admin -- email@loja.com "Senha forte 123" "Nome"
// Com TURSO_DATABASE_URL/TURSO_AUTH_TOKEN no .env, grava direto no banco do site publicado.
const { db, pronto } = require('../src/db');
const { hashSenha, senhaFraca } = require('../src/auth');

(async () => {
  const [email, senha, nome = ''] = process.argv.slice(2);
  if (!email || !senha) {
    console.log('Uso: npm run criar-admin -- email@loja.com "senha com 10+ caracteres" "Nome"');
    process.exit(1);
  }
  const fraca = senhaFraca(senha);
  if (fraca) { console.error(fraca); process.exit(1); }
  await pronto();
  const existe = await db.get('SELECT id FROM users WHERE email = ?', email.toLowerCase());
  if (existe) {
    await db.run('UPDATE users SET senha_hash = ?, tentativas = 0, bloqueado_ate = NULL WHERE id = ?', hashSenha(senha), existe.id);
    await db.run('DELETE FROM sessions WHERE user_id = ?', existe.id);
    console.log(`Senha de ${email} redefinida.`);
  } else {
    await db.run('INSERT INTO users (email, nome, senha_hash) VALUES (?, ?, ?)', email.toLowerCase(), nome, hashSenha(senha));
    console.log(`Acesso criado para ${email}. Entre em /admin.`);
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
