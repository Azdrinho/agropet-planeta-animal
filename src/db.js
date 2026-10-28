// Banco SQLite embutido no Node (node:sqlite). Um arquivo só: data/loja.db
// Dinheiro sempre em centavos (inteiro) para não ter erro de arredondamento.
process.removeAllListeners('warning'); // silencia o aviso "SQLite is experimental"
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const PASTA = path.join(__dirname, '..', 'data');
fs.mkdirSync(PASTA, { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(PASTA, 'loja.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  cor TEXT NOT NULL DEFAULT 'verde',
  arte TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  marca TEXT NOT NULL DEFAULT '',
  categoria_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  especie TEXT NOT NULL DEFAULT 'todos',
  resumo TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL DEFAULT '',
  modo_uso TEXT NOT NULL DEFAULT '',
  selo TEXT NOT NULL DEFAULT '',
  destaque INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rotulo TEXT NOT NULL DEFAULT '',
  preco INTEGER NOT NULL DEFAULT 0,
  preco_promo INTEGER,
  sku TEXT NOT NULL DEFAULT '',
  estoque TEXT NOT NULL DEFAULT 'disponivel',
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_info (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  chave TEXT NOT NULL,
  valor TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_images (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  arquivo TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nome TEXT NOT NULL DEFAULT '',
  senha_hash TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_login TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  expira_em TEXT NOT NULL,
  ip TEXT NOT NULL DEFAULT '',
  agente TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  acao TEXT NOT NULL,
  alvo TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prod_cat ON products(categoria_id);
CREATE INDEX IF NOT EXISTS idx_var_prod ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_img_prod ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_info_prod ON product_info(product_id);
`);

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
const insereCfg = db.prepare('INSERT OR IGNORE INTO settings (chave, valor) VALUES (?, ?)');
for (const [k, v] of Object.entries(PADRAO)) insereCfg.run(k, v);

function config() {
  const out = {};
  for (const r of db.prepare('SELECT chave, valor FROM settings').all()) out[r.chave] = r.valor;
  return out;
}

function transacao(fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { db, config, transacao, CHAVES_CONFIG: Object.keys(PADRAO) };
