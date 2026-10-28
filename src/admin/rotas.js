// Rotas do painel. Tudo atrás de login; todo POST com CSRF; todo dado validado no servidor.
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { db, config, transacao, CHAVES_CONFIG } = require('../db');
const auth = require('../auth');
const cat = require('../catalogo');
const { salvarImagem, apagarImagem, TIPOS } = require('../imagens');
const { paraCentavos, slugify, ESPECIES, SELOS, ESTOQUE, CORES } = require('../util');
const V = require('./views');

const r = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 12, fields: 400, fieldSize: 20000 },
  fileFilter: (_req, file, cb) => cb(null, TIPOS.has(file.mimetype)),
});
const formSimples = express.urlencoded({ extended: true, limit: '200kb', parameterLimit: 400 });

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).send(String(V.entrar({ erro: 'Muitas tentativas. Espere 15 minutos.' }))),
});

r.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});
r.use(auth.sessao);

const envia = (res, conteudo, status = 200) => res.status(status).type('html').send(String(conteudo));
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next); // erros async vão para o tratador
const txt = (v, max) => String(Array.isArray(v) ? v[0] : v ?? '').trim().slice(0, max);
const lista = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const inteiro = (v, min, max, padrao = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};
const avisoDe = (req) => ({ ok: 'Salvo!', criado: 'Criado!', excluido: 'Excluído.', senha: 'Senha trocada.' }[req.query.aviso] || '');

// ---------- entrar / sair ----------
r.get('/entrar', (req, res) => (req.admin ? res.redirect('/admin') : envia(res, V.entrar({}))));
r.post('/entrar', limiteLogin, formSimples, (req, res) => {
  const email = txt(req.body.email, 120);
  const out = auth.login(req, res, email, txt(req.body.senha, 200));
  if (out.erro) return envia(res, V.entrar({ erro: out.erro, email }), 401);
  res.redirect(303, '/admin');
});

r.use(auth.exigeAdmin);

r.post('/sair', formSimples, auth.confereCsrf, (req, res) => {
  auth.registrar(req.admin.id, 'saiu do painel', '', req);
  auth.sair(req, res);
  res.redirect(303, '/admin/entrar');
});

// ---------- painel ----------
r.get('/', (req, res) => {
  const um = (sql) => db.prepare(sql).get().n;
  const n = {
    ativos: um('SELECT COUNT(*) n FROM products WHERE ativo = 1'),
    inativos: um('SELECT COUNT(*) n FROM products WHERE ativo = 0'),
    ofertas: um('SELECT COUNT(DISTINCT product_id) n FROM variants WHERE preco_promo IS NOT NULL AND preco_promo < preco'),
    categorias: um('SELECT COUNT(*) n FROM categories'),
  };
  const semFoto = db.prepare('SELECT id, nome FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id) ORDER BY nome LIMIT 10').all();
  const semPreco = db.prepare('SELECT id, nome FROM products p WHERE NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.preco > 0) ORDER BY nome LIMIT 10').all();
  const atividade = db.prepare('SELECT a.*, u.email FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 12').all();
  envia(res, V.painel({ admin: req.admin, n, semFoto, semPreco, atividade, aviso: avisoDe(req) }));
});

// ---------- produtos ----------
r.get('/produtos', (req, res) => {
  const f = { q: txt(req.query.q, 60), cat: txt(req.query.cat, 10), status: txt(req.query.status, 12) };
  const onde = [];
  const args = [];
  if (f.q) { onde.push("(p.nome LIKE ? ESCAPE '\\' OR p.marca LIKE ? ESCAPE '\\')"); const t = `%${f.q.replace(/[%_\\]/g, (m) => '\\' + m)}%`; args.push(t, t); }
  if (f.cat) { onde.push('p.categoria_id = ?'); args.push(inteiro(f.cat, 0, 1e9)); }
  if (f.status === 'ativos') onde.push('p.ativo = 1');
  if (f.status === 'inativos') onde.push('p.ativo = 0');
  if (f.status === 'destaques') onde.push('p.destaque = 1');
  if (f.status === 'ofertas') onde.push('EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.preco_promo IS NOT NULL AND v.preco_promo < v.preco)');
  const itens = cat.enriquecer(db.prepare(`SELECT p.*, c.nome AS categoria_nome FROM products p LEFT JOIN categories c ON c.id = p.categoria_id
    ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY p.atualizado_em DESC LIMIT 500`).all(...args));
  envia(res, V.listaProdutos({ admin: req.admin, itens, f, cats: cat.categorias({ todas: true }), aviso: avisoDe(req) }));
});

function carregarProduto(id) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) return null;
  p.variantes = db.prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY ordem, id').all(id);
  p.info = db.prepare('SELECT * FROM product_info WHERE product_id = ? ORDER BY ordem, id').all(id);
  p.imagens = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY ordem, id').all(id);
  return p;
}

function telaProduto(req, res, p, erro, status = 200) {
  envia(res, V.formProduto({ admin: req.admin, p, cats: cat.categorias({ todas: true }), marcas: cat.marcas(), erro, aviso: avisoDe(req) }), status);
}

r.get('/produtos/novo', (req, res) => telaProduto(req, res, { especie: 'caes', ativo: 1 }));
r.get('/produtos/:id(\\d+)', (req, res) => {
  const p = carregarProduto(Number(req.params.id));
  if (!p) return res.redirect('/admin/produtos');
  telaProduto(req, res, p);
});

// O que a pessoa digitou, para devolver ao formulário quando houver erro (nada se perde)
function rascunho(body) {
  const rot = lista(body.var_rotulo);
  return {
    variantes: rot.slice(0, 40).map((r, i) => ({
      rotulo: txt(r, 40), preco: paraCentavos(txt(lista(body.var_preco)[i], 20)), preco_promo: paraCentavos(txt(lista(body.var_promo)[i], 20)),
      sku: txt(lista(body.var_sku)[i], 40), estoque: txt(lista(body.var_estoque)[i], 20),
    })),
    info: lista(body.info_chave).slice(0, 40).map((c, i) => ({ chave: txt(c, 40), valor: txt(lista(body.info_valor)[i], 200) })),
  };
}

// Lê e valida o formulário de produto. Devolve { dados, variantes, info } ou { erro }
function lerProduto(body) {
  const dados = {
    nome: txt(body.nome, 140),
    marca: txt(body.marca, 60),
    categoria_id: body.categoria_id ? inteiro(body.categoria_id, 1, 1e9, null) : null,
    especie: ESPECIES[txt(body.especie, 10)] ? txt(body.especie, 10) : 'todos',
    selo: Object.prototype.hasOwnProperty.call(SELOS, txt(body.selo, 20)) ? txt(body.selo, 20) : '',
    resumo: txt(body.resumo, 280),
    descricao: txt(body.descricao, 6000),
    modo_uso: txt(body.modo_uso, 3000),
    ativo: body.ativo ? 1 : 0,
    destaque: body.destaque ? 1 : 0,
    ordem: inteiro(body.ordem, 0, 9999),
    slug: slugify(txt(body.slug, 80) || txt(body.nome, 140)),
  };
  if (!dados.nome) return { erro: 'Dê um nome ao produto.' };
  if (dados.categoria_id && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(dados.categoria_id)) dados.categoria_id = null;
  const rot = lista(body.var_rotulo);
  const variantes = [];
  for (let i = 0; i < Math.min(rot.length, 40); i++) {
    const rotulo = txt(rot[i], 40);
    const precoTxt = txt(lista(body.var_preco)[i], 20);
    const promoTxt = txt(lista(body.var_promo)[i], 20);
    if (!rotulo && !precoTxt) continue;
    const preco = paraCentavos(precoTxt);
    if (preco === null) return { erro: `Preço inválido na opção "${rotulo || i + 1}". Use o formato 59,90.` };
    const promo = promoTxt ? paraCentavos(promoTxt) : null;
    if (promoTxt && promo === null) return { erro: `Preço promocional inválido na opção "${rotulo || i + 1}".` };
    if (promo !== null && promo >= preco) return { erro: `O preço promocional da opção "${rotulo || i + 1}" precisa ser menor que o preço normal.` };
    const estoque = txt(lista(body.var_estoque)[i], 20);
    variantes.push({ rotulo, preco, preco_promo: promo, sku: txt(lista(body.var_sku)[i], 40), estoque: ESTOQUE[estoque] ? estoque : 'disponivel', ordem: i });
  }
  const chaves = lista(body.info_chave);
  const info = [];
  for (let i = 0; i < Math.min(chaves.length, 40); i++) {
    const chave = txt(chaves[i], 40);
    const valor = txt(lista(body.info_valor)[i], 200);
    if (chave && valor) info.push({ chave, valor, ordem: i });
  }
  return { dados, variantes, info };
}

function slugLivre(tabela, slug, id) {
  let s = slug;
  for (let n = 2; db.prepare(`SELECT 1 FROM ${tabela} WHERE slug = ? AND id <> ?`).get(s, id || 0); n++) s = `${slug}-${n}`;
  return s;
}

async function processaFotos(req, productId) {
  const arquivos = (req.files || []).filter((f) => f.fieldname === 'imagens');
  let ordem = db.prepare('SELECT COALESCE(MAX(ordem), 0) m FROM product_images WHERE product_id = ?').get(productId).m;
  const nome = db.prepare('SELECT nome FROM products WHERE id = ?').get(productId).nome;
  const falhas = [];
  for (const f of arquivos) {
    try {
      const base = await salvarImagem(f.buffer, 'produtos');
      db.prepare('INSERT INTO product_images (product_id, arquivo, alt, ordem) VALUES (?, ?, ?, ?)').run(productId, base, nome, ++ordem);
    } catch {
      falhas.push(f.originalname);
    }
  }
  return falhas;
}

function salvarVariantesInfo(id, variantes, info) {
  db.prepare('DELETE FROM variants WHERE product_id = ?').run(id);
  const iv = db.prepare('INSERT INTO variants (product_id, rotulo, preco, preco_promo, sku, estoque, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const v of variantes) iv.run(id, v.rotulo, v.preco, v.preco_promo, v.sku, v.estoque, v.ordem);
  db.prepare('DELETE FROM product_info WHERE product_id = ?').run(id);
  const ii = db.prepare('INSERT INTO product_info (product_id, chave, valor, ordem) VALUES (?, ?, ?, ?)');
  for (const i of info) ii.run(id, i.chave, i.valor, i.ordem);
}

r.post('/produtos/novo', upload.any(), auth.confereCsrf, a(async (req, res) => {
  const lido = lerProduto(req.body);
  if (lido.erro) return telaProduto(req, res, { ...req.body, ativo: req.body.ativo ? 1 : 0, destaque: req.body.destaque ? 1 : 0, ...rascunho(req.body) }, lido.erro + ' As fotos precisam ser escolhidas de novo.', 400);
  const { dados, variantes, info } = lido;
  dados.slug = slugLivre('products', dados.slug, 0);
  const id = transacao(() => {
    const out = db.prepare(`INSERT INTO products (slug, nome, marca, categoria_id, especie, resumo, descricao, modo_uso, selo, destaque, ativo, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(dados.slug, dados.nome, dados.marca, dados.categoria_id, dados.especie, dados.resumo,
      dados.descricao, dados.modo_uso, dados.selo, dados.destaque, dados.ativo, dados.ordem);
    const novoId = Number(out.lastInsertRowid);
    salvarVariantesInfo(novoId, variantes, info);
    return novoId;
  });
  const falhas = await processaFotos(req, id);
  auth.registrar(req.admin.id, 'criou produto', dados.nome, req);
  if (falhas.length) return res.redirect(303, `/admin/produtos/${id}?aviso=criado&falhas=${falhas.length}`);
  res.redirect(303, `/admin/produtos/${id}?aviso=criado`);
}));

r.post('/produtos/:id(\\d+)', upload.any(), auth.confereCsrf, a(async (req, res) => {
  const id = Number(req.params.id);
  const atual = carregarProduto(id);
  if (!atual) return res.redirect(303, '/admin/produtos');
  const lido = lerProduto(req.body);
  if (lido.erro) return telaProduto(req, res, { ...atual, ...req.body, id, slug: atual.slug, imagens: atual.imagens, ativo: req.body.ativo ? 1 : 0, destaque: req.body.destaque ? 1 : 0, ...rascunho(req.body) }, lido.erro, 400);
  const { dados, variantes, info } = lido;
  dados.slug = slugLivre('products', dados.slug, id);
  const remover = new Set(lista(req.body.remover_img).map((x) => inteiro(x, 0, 1e9)));
  const apagar = [];
  transacao(() => {
    db.prepare(`UPDATE products SET slug=?, nome=?, marca=?, categoria_id=?, especie=?, resumo=?, descricao=?, modo_uso=?, selo=?, destaque=?, ativo=?, ordem=?,
      atualizado_em=datetime('now') WHERE id=?`).run(dados.slug, dados.nome, dados.marca, dados.categoria_id, dados.especie, dados.resumo,
      dados.descricao, dados.modo_uso, dados.selo, dados.destaque, dados.ativo, dados.ordem, id);
    salvarVariantesInfo(id, variantes, info);
    for (const im of atual.imagens) {
      if (remover.has(im.id)) {
        db.prepare('DELETE FROM product_images WHERE id = ? AND product_id = ?').run(im.id, id);
        apagar.push(im.arquivo);
      } else {
        db.prepare('UPDATE product_images SET alt = ?, ordem = ? WHERE id = ?')
          .run(txt(req.body[`img_alt_${im.id}`], 140) || dados.nome, inteiro(req.body[`img_ordem_${im.id}`], 1, 99, im.ordem), im.id);
      }
    }
  });
  apagar.forEach(apagarImagem);
  await processaFotos(req, id);
  auth.registrar(req.admin.id, 'editou produto', dados.nome, req);
  res.redirect(303, `/admin/produtos/${id}?aviso=ok`);
}));

r.post('/produtos/:id(\\d+)/alternar', formSimples, auth.confereCsrf, (req, res) => {
  const campo = req.body.campo === 'destaque' ? 'destaque' : 'ativo';
  const id = Number(req.params.id);
  db.prepare(`UPDATE products SET ${campo} = 1 - ${campo}, atualizado_em = datetime('now') WHERE id = ?`).run(id);
  const p = db.prepare('SELECT nome FROM products WHERE id = ?').get(id);
  if (p) auth.registrar(req.admin.id, campo === 'ativo' ? 'mudou visibilidade' : 'mudou destaque', p.nome, req);
  res.redirect(303, req.get('referer') && req.get('referer').includes('/admin/produtos') ? '/admin/produtos?' + (new URL(req.get('referer')).searchParams.toString()) : '/admin/produtos');
});

r.post('/produtos/:id(\\d+)/excluir', formSimples, auth.confereCsrf, (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare('SELECT nome FROM products WHERE id = ?').get(id);
  if (p) {
    const imgs = db.prepare('SELECT arquivo FROM product_images WHERE product_id = ?').all(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    imgs.forEach((i) => apagarImagem(i.arquivo));
    auth.registrar(req.admin.id, 'excluiu produto', p.nome, req);
  }
  res.redirect(303, '/admin/produtos?aviso=excluido');
});

// ---------- categorias ----------
r.get('/categorias', (req, res) => envia(res, V.listaCategorias({ admin: req.admin, cats: cat.categorias({ todas: true }), aviso: avisoDe(req) })));
r.get('/categorias/nova', (req, res) => envia(res, V.formCategoria({ admin: req.admin, c: { cor: 'verde', ativo: 1 } })));
r.get('/categorias/:id(\\d+)', (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
  if (!c) return res.redirect('/admin/categorias');
  envia(res, V.formCategoria({ admin: req.admin, c }));
});

async function salvarCategoria(req, res, id) {
  const atual = id ? db.prepare('SELECT * FROM categories WHERE id = ?').get(id) : null;
  const c = {
    nome: txt(req.body.nome, 60),
    descricao: txt(req.body.descricao, 300),
    cor: CORES[txt(req.body.cor, 10)] ? txt(req.body.cor, 10) : 'verde',
    ordem: inteiro(req.body.ordem, 0, 999),
    ativo: req.body.ativo ? 1 : 0,
  };
  if (!c.nome) return envia(res, V.formCategoria({ admin: req.admin, c: { ...atual, ...c }, erro: 'Dê um nome à categoria.' }), 400);
  c.slug = slugLivre('categories', slugify(txt(req.body.slug, 80) || c.nome), id || 0);
  let arte = atual ? atual.arte : '';
  const arquivo = (req.files || []).find((f) => f.fieldname === 'arte');
  if (arquivo) {
    try {
      const nova = await salvarImagem(arquivo.buffer, 'categorias');
      if (arte) apagarImagem(arte);
      arte = nova;
    } catch {
      return envia(res, V.formCategoria({ admin: req.admin, c: { ...atual, ...c }, erro: 'Não consegui ler essa imagem. Tente outro arquivo.' }), 400);
    }
  } else if (req.body.remover_arte && arte) {
    apagarImagem(arte);
    arte = '';
  }
  if (id) {
    db.prepare('UPDATE categories SET nome=?, slug=?, descricao=?, cor=?, ordem=?, ativo=?, arte=? WHERE id=?').run(c.nome, c.slug, c.descricao, c.cor, c.ordem, c.ativo, arte, id);
  } else {
    db.prepare('INSERT INTO categories (nome, slug, descricao, cor, ordem, ativo, arte) VALUES (?, ?, ?, ?, ?, ?, ?)').run(c.nome, c.slug, c.descricao, c.cor, c.ordem, c.ativo, arte);
  }
  auth.registrar(req.admin.id, id ? 'editou categoria' : 'criou categoria', c.nome, req);
  res.redirect(303, '/admin/categorias?aviso=ok');
}
r.post('/categorias/nova', upload.any(), auth.confereCsrf, a((req, res) => salvarCategoria(req, res, 0)));
r.post('/categorias/:id(\\d+)', upload.any(), auth.confereCsrf, a((req, res) => salvarCategoria(req, res, Number(req.params.id))));
r.post('/categorias/:id(\\d+)/excluir', formSimples, auth.confereCsrf, (req, res) => {
  const c = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
  if (c) {
    db.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
    if (c.arte) apagarImagem(c.arte);
    auth.registrar(req.admin.id, 'excluiu categoria', c.nome, req);
  }
  res.redirect(303, '/admin/categorias?aviso=excluido');
});

// ---------- dados da loja ----------
r.get('/loja', (req, res) => envia(res, V.formLoja({ admin: req.admin, cfg: config(), aviso: avisoDe(req) })));
r.post('/loja', formSimples, auth.confereCsrf, (req, res) => {
  const cfg = {};
  for (const k of CHAVES_CONFIG) cfg[k] = txt(req.body[k], 2000).replace(/\r\n/g, '\n');
  if (cfg.mapa_link && !/^https:\/\//i.test(cfg.mapa_link)) {
    return envia(res, V.formLoja({ admin: req.admin, cfg, erro: 'O link do mapa precisa começar com https://' }), 400);
  }
  cfg.whatsapp = cfg.whatsapp.replace(/\D/g, '').slice(0, 15);
  if (cfg.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) {
    return envia(res, V.formLoja({ admin: req.admin, cfg, erro: 'E-mail inválido.' }), 400);
  }
  const up = db.prepare('INSERT INTO settings (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
  transacao(() => { for (const [k, v] of Object.entries(cfg)) up.run(k, v); });
  auth.registrar(req.admin.id, 'editou dados da loja', '', req);
  res.redirect(303, '/admin/loja?aviso=ok');
});

// ---------- usuários ----------
const listaUsuarios = () => db.prepare('SELECT id, email, nome, ultimo_login FROM users ORDER BY email').all();
r.get('/usuarios', (req, res) => envia(res, V.usuarios({ admin: req.admin, lista: listaUsuarios(), aviso: avisoDe(req) })));
r.post('/usuarios', formSimples, auth.confereCsrf, (req, res) => {
  const email = txt(req.body.email, 120).toLowerCase();
  const senha = txt(req.body.senha, 200);
  const erro = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'E-mail inválido.'
    : db.prepare('SELECT 1 FROM users WHERE email = ?').get(email) ? 'Esse e-mail já tem acesso.'
      : auth.senhaFraca(senha);
  if (erro) return envia(res, V.usuarios({ admin: req.admin, lista: listaUsuarios(), erro }), 400);
  db.prepare('INSERT INTO users (email, nome, senha_hash) VALUES (?, ?, ?)').run(email, txt(req.body.nome, 60), auth.hashSenha(senha));
  auth.registrar(req.admin.id, 'criou acesso', email, req);
  res.redirect(303, '/admin/usuarios?aviso=criado');
});
r.post('/usuarios/:id(\\d+)/excluir', formSimples, auth.confereCsrf, (req, res) => {
  const id = Number(req.params.id);
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(id);
  if (u && id !== req.admin.id) {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    auth.registrar(req.admin.id, 'removeu acesso', u.email, req);
  }
  res.redirect(303, '/admin/usuarios?aviso=excluido');
});

r.get('/conta', (req, res) => envia(res, V.conta({ admin: req.admin, aviso: avisoDe(req) })));
r.post('/conta', formSimples, auth.confereCsrf, (req, res) => {
  const u = db.prepare('SELECT senha_hash FROM users WHERE id = ?').get(req.admin.id);
  const nova = txt(req.body.nova, 200);
  const erro = !auth.confereSenha(txt(req.body.atual, 200), u.senha_hash) ? 'Senha atual incorreta.'
    : nova !== txt(req.body.nova2, 200) ? 'As senhas novas não são iguais.'
      : auth.senhaFraca(nova);
  if (erro) return envia(res, V.conta({ admin: req.admin, erro }), 400);
  db.prepare('UPDATE users SET senha_hash = ? WHERE id = ?').run(auth.hashSenha(nova), req.admin.id);
  // derruba as outras sessões dessa pessoa
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND csrf <> ?').run(req.admin.id, req.admin.csrf);
  auth.registrar(req.admin.id, 'trocou a senha', '', req);
  res.redirect(303, '/admin/conta?aviso=senha');
});

r.get('/atividade', (req, res) => {
  const lista2 = db.prepare('SELECT a.*, u.email FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300').all();
  envia(res, V.atividade({ admin: req.admin, lista: lista2 }));
});

// erros de upload (arquivo grande demais etc.)
r.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Arquivo grande demais (máximo 8 MB por foto).' : 'Envio inválido.';
    return res.status(400).type('html').send(String(V.base({ titulo: 'Erro', admin: req.admin, erro: msg, corpo: '<p><a class="btn btn-sec" href="/admin/produtos">Voltar aos produtos</a></p>' })));
  }
  next(err);
});

module.exports = r;
