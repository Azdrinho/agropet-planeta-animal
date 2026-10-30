// Banco libSQL (SQLite). Na Vercel usa o Turso (TURSO_DATABASE_URL + TURSO_AUTH_TOKEN);
// no computador, sem essas variáveis, usa o arquivo data/loja.db.
// Dinheiro sempre em centavos (inteiro) para não ter erro de arredondamento.
require('./env');
const { createClient } = require('@libsql/client');
const path = require('node:path');
const fs = require('node:fs');

function criarCliente() {
  if (process.env.TURSO_DATABASE_URL) {
    return createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  if (process.env.VERCEL) throw new Error('Configure TURSO_DATABASE_URL e TURSO_AUTH_TOKEN nas variáveis de ambiente da Vercel.');
  const pasta = path.join(__dirname, '..', 'data');
  fs.mkdirSync(pasta, { recursive: true });
  return createClient({ url: 'file:' + (process.env.DB_PATH || path.join(pasta, 'loja.db')).replace(/\\/g, '/') });
}
const cliente = criarCliente();

const objetos = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

// Mesma interface para o banco e para uma transação: all / get / run (todos assíncronos)
function interface_(alvo) {
  const exec = (sql, args) => alvo.execute({ sql, args });
  return {
    all: async (sql, ...args) => objetos(await exec(sql, args)),
    get: async (sql, ...args) => objetos(await exec(sql, args))[0],
    run: async (sql, ...args) => {
      const r = await exec(sql, args);
      return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid === undefined ? null : Number(r.lastInsertRowid) };
    },
  };
}
const db = interface_(cliente);

async function transacao(fn) {
  const tx = await cliente.transaction('write');
  try {
    const r = await fn(interface_(tx));
    await tx.commit();
    return r;
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  } finally {
    tx.close();
  }
}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS settings (chave TEXT PRIMARY KEY, valor TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT 'verde', arte TEXT NOT NULL DEFAULT '', ordem INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, marca TEXT NOT NULL DEFAULT '',
  categoria_id INTEGER, especie TEXT NOT NULL DEFAULT 'todos', resumo TEXT NOT NULL DEFAULT '', descricao TEXT NOT NULL DEFAULT '',
  modo_uso TEXT NOT NULL DEFAULT '', selo TEXT NOT NULL DEFAULT '', destaque INTEGER NOT NULL DEFAULT 0, ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0, criado_em TEXT NOT NULL DEFAULT (datetime('now')), atualizado_em TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, rotulo TEXT NOT NULL DEFAULT '', preco INTEGER NOT NULL DEFAULT 0,
  preco_promo INTEGER, sku TEXT NOT NULL DEFAULT '', estoque TEXT NOT NULL DEFAULT 'disponivel', ordem INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS product_info (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, chave TEXT NOT NULL, valor TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, arquivo TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '', ordem INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, nome TEXT NOT NULL DEFAULT '', senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')), ultimo_login TEXT, tentativas INTEGER NOT NULL DEFAULT 0, bloqueado_ate TEXT);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, csrf TEXT NOT NULL, criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '', agente TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY, user_id INTEGER, acao TEXT NOT NULL, alvo TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '',
  em TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(categoria_id);
CREATE INDEX IF NOT EXISTS idx_var_prod ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_img_prod ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_info_prod ON product_info(product_id);
CREATE INDEX IF NOT EXISTS idx_sess_user ON sessions(user_id);
`;

// Configurações padrão da loja (o admin edita tudo isso no painel)
const PADRAO = {
  loja_nome: 'Planeta Animal Agropet',
  assinatura: 'Do campo ao colo.',
  whatsapp: '',
  telefone: '',
  email: '',
  instagram: '',
  endereco: '',
  cidade: '',
  mapa_link: '',
  horario: 'Seg a sex: 8h às 18h\nSábado: 8h às 13h',
  aviso_topo: 'Peça pelo WhatsApp e retire na loja ou receba em casa.',
  hero_titulo: 'Falou ração?',
  hero_texto: 'Ração, petisco, acessório e tudo pro bicho da cidade e da roça. Escolha aqui e finalize pelo WhatsApp.',
  entrega_texto: 'Entregamos na cidade e região. Combine o frete pelo WhatsApp ao finalizar o pedido.',
  pagamento_texto: 'Pix, cartão de crédito e débito, e dinheiro na retirada.',
  sobre_texto: 'A Planeta Animal Agropet nasceu para cuidar de todo bicho: do cão que dorme no sofá à galinha do quintal. Atendimento de quem conhece cada cliente pelo nome do pet.',
};

// Cria as tabelas uma vez por processo (na Vercel, a cada "partida a frio")
let preparo = null;
function pronto() {
  if (!preparo) {
    preparo = (async () => {
      await cliente.executeMultiple(ESQUEMA);
      await cliente.batch(Object.entries(PADRAO).map(([k, v]) => ({ sql: 'INSERT OR IGNORE INTO settings (chave, valor) VALUES (?, ?)', args: [k, v] })), 'write');
    })().catch((e) => { preparo = null; throw e; });
  }
  return preparo;
}

async function config() {
  const out = {};
  for (const r of await db.all('SELECT chave, valor FROM settings')) out[r.chave] = r.valor;
  return out;
}

module.exports = { db, config, transacao, pronto, CHAVES_CONFIG: Object.keys(PADRAO) };
