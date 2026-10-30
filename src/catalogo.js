// Consultas do catálogo (site público e painel). Sempre com parâmetros, nunca concatenando texto do usuário.
const { db } = require('./db');

const POR_PAGINA = 12;

function categorias({ todas = false } = {}) {
  return db.all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.categoria_id = c.id AND p.ativo = 1) AS total
                 FROM categories c ${todas ? '' : 'WHERE c.ativo = 1'} ORDER BY c.ordem, c.nome`);
}

async function marcas() {
  return (await db.all("SELECT DISTINCT marca FROM products WHERE ativo = 1 AND marca <> '' ORDER BY marca")).map((r) => r.marca);
}

// Junta preço mínimo, capa e se tem oferta em cada produto da lista
async function enriquecer(lista) {
  if (!lista.length) return lista;
  const ids = lista.map((p) => p.id);
  const marc = ids.map(() => '?').join(',');
  const [vars, imgs] = await Promise.all([
    db.all(`SELECT * FROM variants WHERE product_id IN (${marc}) ORDER BY ordem, id`, ...ids),
    db.all(`SELECT product_id, arquivo, alt FROM product_images WHERE product_id IN (${marc}) ORDER BY ordem, id`, ...ids),
  ]);
  for (const p of lista) {
    p.variantes = vars.filter((v) => v.product_id === p.id);
    p.imagens = imgs.filter((i) => i.product_id === p.id);
    p.capa = p.imagens[0] ? p.imagens[0].arquivo : '';
    p.capa2 = p.imagens[1] ? p.imagens[1].arquivo : '';
    const vendaveis = p.variantes.filter((v) => v.estoque !== 'esgotado');
    const base = vendaveis.length ? vendaveis : p.variantes;
    let menor = null;
    for (const v of base) {
      const efetivo = v.preco_promo && v.preco_promo < v.preco ? v.preco_promo : v.preco;
      if (menor === null || efetivo < menor.efetivo) menor = { efetivo, cheio: v.preco, promo: v.preco_promo && v.preco_promo < v.preco };
    }
    p.preco = menor;
    p.varios_precos = new Set(base.map((v) => v.preco_promo || v.preco)).size > 1;
    p.esgotado = p.variantes.length > 0 && vendaveis.length === 0;
  }
  return lista;
}

async function listar(f = {}) {
  const onde = ['p.ativo = 1'];
  const args = [];
  if (f.categoria) { onde.push('c.slug = ?'); args.push(String(f.categoria)); }
  if (f.especie) { onde.push('p.especie IN (?, \'todos\')'); args.push(String(f.especie)); }
  if (f.marca) { onde.push('p.marca = ?'); args.push(String(f.marca)); }
  if (f.ofertas) onde.push('EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.preco_promo IS NOT NULL AND v.preco_promo < v.preco)');
  if (f.busca) {
    const termo = `%${String(f.busca).trim().slice(0, 60).replace(/[%_\\]/g, (m) => '\\' + m)}%`;
    onde.push("(p.nome LIKE ? ESCAPE '\\' OR p.marca LIKE ? ESCAPE '\\' OR p.resumo LIKE ? ESCAPE '\\')");
    args.push(termo, termo, termo);
  }
  const precoMin = '(SELECT MIN(COALESCE(v.preco_promo, v.preco)) FROM variants v WHERE v.product_id = p.id)';
  if (Number.isFinite(f.min)) { onde.push(`${precoMin} >= ?`); args.push(f.min); }
  if (Number.isFinite(f.max)) { onde.push(`${precoMin} <= ?`); args.push(f.max); }
  const ordens = {
    relevancia: 'p.destaque DESC, p.ordem, p.nome',
    'menor-preco': `${precoMin} ASC`,
    'maior-preco': `${precoMin} DESC`,
    nome: 'p.nome COLLATE NOCASE',
    novidades: 'p.criado_em DESC',
  };
  const ordem = ordens[f.ordem] || ordens.relevancia;
  const where = 'WHERE ' + onde.join(' AND ');
  const from = 'FROM products p LEFT JOIN categories c ON c.id = p.categoria_id';
  const pagina = Math.max(1, Math.min(Number(f.pagina) || 1, 500));
  const limite = f.limite || POR_PAGINA;
  const [contagem, itens] = await Promise.all([
    db.get(`SELECT COUNT(*) AS n ${from} ${where}`, ...args),
    db.all(`SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug ${from} ${where}
            ORDER BY ${ordem} LIMIT ? OFFSET ?`, ...args, limite, (pagina - 1) * limite),
  ]);
  const total = contagem.n;
  return { itens: await enriquecer(itens), total, pagina, paginas: Math.max(1, Math.ceil(total / limite)) };
}

async function produto(slug) {
  const p = await db.get(`SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug FROM products p
                          LEFT JOIN categories c ON c.id = p.categoria_id WHERE p.slug = ? AND p.ativo = 1`, String(slug));
  if (!p) return null;
  await enriquecer([p]);
  p.info = await db.all('SELECT chave, valor FROM product_info WHERE product_id = ? ORDER BY ordem, id', p.id);
  return p;
}

async function relacionados(p, n = 4) {
  const lista = await db.all(`SELECT p.*, c.slug AS categoria_slug FROM products p LEFT JOIN categories c ON c.id = p.categoria_id
                              WHERE p.ativo = 1 AND p.id <> ? AND (p.categoria_id = ? OR p.especie = ?)
                              ORDER BY p.destaque DESC, RANDOM() LIMIT ?`, p.id, p.categoria_id, p.especie, n);
  return enriquecer(lista);
}

async function destaques(n = 8) {
  return enriquecer(await db.all('SELECT * FROM products WHERE ativo = 1 AND destaque = 1 ORDER BY ordem, id DESC LIMIT ?', n));
}

async function ofertas(n = 8) {
  return (await listar({ ofertas: true, limite: n })).itens;
}

module.exports = { categorias, marcas, listar, produto, relacionados, destaques, ofertas, enriquecer, POR_PAGINA };
