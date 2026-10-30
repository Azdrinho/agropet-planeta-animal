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
// A Vercel aceita no máximo 4,5 MB por envio: o painel reduz as fotos no navegador antes de mandar.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 12, fields: 400, fieldSize: 20000 },
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
r.post('/entrar', limiteLogin, formSimples, a(async (req, res) => {
  const email = txt(req.body.email, 120);
  const out = await auth.login(req, res, email, txt(req.body.senha, 200));
  if (out.erro) return envia(res, V.entrar({ erro: out.erro, email }), 401);
  res.redirect(303, '/admin');
}));

r.use(auth.exigeAdmin);

r.post('/sair', formSimples, auth.confereCsrf, a(async (req, res) => {
  await auth.registrar(req.admin.id, 'saiu do painel', '', req);
  await auth.sair(req, res);
  res.redirect(303, '/admin/entrar');
}));

// ---------- painel ----------
r.get('/', a(async (req, res) => {
  const um = async (sql) => (await db.get(sql)).n;
  const [ativos, inativos, ofertas, categorias, semFoto, semPreco, atividade] = await Promise.all([
    um('SELECT COUNT(*) n FROM products WHERE ativo = 1'),
    um('SELECT COUNT(*) n FROM products WHERE ativo = 0'),
    um('SELECT COUNT(DISTINCT product_id) n FROM variants WHERE preco_promo IS NOT NULL AND preco_promo < preco'),
    um('SELECT COUNT(*) n FROM categories'),
    db.all('SELECT id, nome FROM products p WHERE NOT EXISTS (SELECT 1 FROM product_images i WHERE i.product_id = p.id) ORDER BY nome LIMIT 10'),
    db.all('SELECT id, nome FROM products p WHERE NOT EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.preco > 0) ORDER BY nome LIMIT 10'),
    db.all('SELECT a.*, u.email FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 12'),
  ]);
  envia(res, V.painel({ admin: req.admin, n: { ativos, inativos, ofertas, categorias }, semFoto, semPreco, atividade, aviso: avisoDe(req) }));
}));

// ---------- produtos ----------
r.get('/produtos', a(async (req, res) => {
  const f = { q: txt(req.query.q, 60), cat: txt(req.query.cat, 10), status: txt(req.query.status, 12) };
  const onde = [];
  const args = [];
  if (f.q) { onde.push("(p.nome LIKE ? ESCAPE '\\' OR p.marca LIKE ? ESCAPE '\\')"); const t = `%${f.q.replace(/[%_\\]/g, (m) => '\\' + m)}%`; args.push(t, t); }
  if (f.cat) { onde.push('p.categoria_id = ?'); args.push(inteiro(f.cat, 0, 1e9)); }
  if (f.status === 'ativos') onde.push('p.ativo = 1');
  if (f.status === 'inativos') onde.push('p.ativo = 0');
  if (f.status === 'destaques') onde.push('p.destaque = 1');
  if (f.status === 'ofertas') onde.push('EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.preco_promo IS NOT NULL AND v.preco_promo < v.preco)');
  const itens = await cat.enriquecer(await db.all(`SELECT p.*, c.nome AS categoria_nome FROM products p LEFT JOIN categories c ON c.id = p.categoria_id
    ${onde.length ? 'WHERE ' + onde.join(' AND ') : ''} ORDER BY p.atualizado_em DESC LIMIT 500`, ...args));
  envia(res, V.listaProdutos({ admin: req.admin, itens, f, cats: await cat.categorias({ todas: true }), aviso: avisoDe(req) }));
}));

async function carregarProduto(id) {
  const p = await db.get('SELECT * FROM products WHERE id = ?', id);
  if (!p) return null;
  [p.variantes, p.info, p.imagens] = await Promise.all([
    db.all('SELECT * FROM variants WHERE product_id = ? ORDER BY ordem, id', id),
    db.all('SELECT * FROM product_info WHERE product_id = ? ORDER BY ordem, id', id),
    db.all('SELECT * FROM product_images WHERE product_id = ? ORDER BY ordem, id', id),
  ]);
  return p;
}

async function telaProduto(req, res, p, erro, status = 200) {
  const [cats, marcas] = await Promise.all([cat.categorias({ todas: true }), cat.marcas()]);
  envia(res, V.formProduto({ admin: req.admin, p, cats, marcas, erro, aviso: avisoDe(req) }), status);
}

r.get('/produtos/novo', a((req, res) => telaProduto(req, res, { especie: 'caes', ativo: 1 })));
r.get('/produtos/:id(\\d+)', a(async (req, res) => {
  const p = await carregarProduto(Number(req.params.id));
  if (!p) return res.redirect('/admin/produtos');
  await telaProduto(req, res, p);
}));

// O que a pessoa digitou, para devolver ao formulário quando houver erro (nada se perde)
function rascunho(body) {
  const rot = lista(body.var_rotulo);
  return {
    variantes: rot.slice(0, 40).map((r2, i) => ({
      rotulo: txt(r2, 40), preco: paraCentavos(txt(lista(body.var_preco)[i], 20)), preco_promo: paraCentavos(txt(lista(body.var_promo)[i], 20)),
      sku: txt(lista(body.var_sku)[i], 40), estoque: txt(lista(body.var_estoque)[i], 20),
    })),
    info: lista(body.info_chave).slice(0, 40).map((c, i) => ({ chave: txt(c, 40), valor: txt(lista(body.info_valor)[i], 200) })),
  };
}

// Lê e valida o formulário de produto. Devolve { dados, variantes, info } ou { erro }
async function lerProduto(body) {
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
  if (dados.categoria_id && !(await db.get('SELECT 1 AS ok FROM categories WHERE id = ?', dados.categoria_id))) dados.categoria_id = null;
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

async function slugLivre(tabela, slug, id) {
  let s = slug;
  for (let n = 2; await db.get(`SELECT 1 AS ok FROM ${tabela} WHERE slug = ? AND id <> ?`, s, id || 0); n++) s = `${slug}-${n}`;
  return s;
}

// Envia as fotos para o armazenamento (fora da transação) e registra no banco
async function processaFotos(req, productId, nome) {
  const arquivos = (req.files || []).filter((f) => f.fieldname === 'imagens');
  let ordem = (await db.get('SELECT COALESCE(MAX(ordem), 0) m FROM product_images WHERE product_id = ?', productId)).m;
  const falhas = [];
  for (const f of arquivos) {
    try {
      const base = await salvarImagem(f.buffer, 'produtos');
      await db.run('INSERT INTO product_images (product_id, arquivo, alt, ordem) VALUES (?, ?, ?, ?)', productId, base, nome, ++ordem);
    } catch (e) {
      console.error('Falha ao salvar foto', e.message);
      falhas.push(f.originalname);
    }
  }
  return falhas;
}

async function salvarVariantesInfo(t, id, variantes, info) {
  await t.run('DELETE FROM variants WHERE product_id = ?', id);
  for (const v of variantes) {
    await t.run('INSERT INTO variants (product_id, rotulo, preco, preco_promo, sku, estoque, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id, v.rotulo, v.preco, v.preco_promo, v.sku, v.estoque, v.ordem);
  }
  await t.run('DELETE FROM product_info WHERE product_id = ?', id);
  for (const i of info) await t.run('INSERT INTO product_info (product_id, chave, valor, ordem) VALUES (?, ?, ?, ?)', id, i.chave, i.valor, i.ordem);
}

r.post('/produtos/novo', upload.any(), auth.confereCsrf, a(async (req, res) => {
  const lido = await lerProduto(req.body);
  if (lido.erro) return telaProduto(req, res, { ...req.body, ativo: req.body.ativo ? 1 : 0, destaque: req.body.destaque ? 1 : 0, ...rascunho(req.body) }, lido.erro + ' As fotos precisam ser escolhidas de novo.', 400);
  const { dados, variantes, info } = lido;
  dados.slug = await slugLivre('products', dados.slug, 0);
  const id = await transacao(async (t) => {
    const out = await t.run(`INSERT INTO products (slug, nome, marca, categoria_id, especie, resumo, descricao, modo_uso, selo, destaque, ativo, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, dados.slug, dados.nome, dados.marca, dados.categoria_id, dados.especie, dados.resumo,
    dados.descricao, dados.modo_uso, dados.selo, dados.destaque, dados.ativo, dados.ordem);
    await salvarVariantesInfo(t, out.lastInsertRowid, variantes, info);
    return out.lastInsertRowid;
  });
  const falhas = await processaFotos(req, id, dados.nome);
  await auth.registrar(req.admin.id, 'criou produto', dados.nome, req);
  res.redirect(303, `/admin/produtos/${id}?aviso=criado${falhas.length ? `&falhas=${falhas.length}` : ''}`);
}));

r.post('/produtos/:id(\\d+)', upload.any(), auth.confereCsrf, a(async (req, res) => {
  const id = Number(req.params.id);
  const atual = await carregarProduto(id);
  if (!atual) return res.redirect(303, '/admin/produtos');
  const lido = await lerProduto(req.body);
  if (lido.erro) return telaProduto(req, res, { ...atual, ...req.body, id, slug: atual.slug, imagens: atual.imagens, ativo: req.body.ativo ? 1 : 0, destaque: req.body.destaque ? 1 : 0, ...rascunho(req.body) }, lido.erro, 400);
  const { dados, variantes, info } = lido;
  dados.slug = await slugLivre('products', dados.slug, id);
  const remover = new Set(lista(req.body.remover_img).map((x) => inteiro(x, 0, 1e9)));
  const apagar = [];
  await transacao(async (t) => {
    await t.run(`UPDATE products SET slug=?, nome=?, marca=?, categoria_id=?, especie=?, resumo=?, descricao=?, modo_uso=?, selo=?, destaque=?, ativo=?, ordem=?,
      atualizado_em=datetime('now') WHERE id=?`, dados.slug, dados.nome, dados.marca, dados.categoria_id, dados.especie, dados.resumo,
    dados.descricao, dados.modo_uso, dados.selo, dados.destaque, dados.ativo, dados.ordem, id);
    await salvarVariantesInfo(t, id, variantes, info);
    for (const im of atual.imagens) {
      if (remover.has(im.id)) {
        await t.run('DELETE FROM product_images WHERE id = ? AND product_id = ?', im.id, id);
        apagar.push(im.arquivo);
      } else {
        await t.run('UPDATE product_images SET alt = ?, ordem = ? WHERE id = ?',
          txt(req.body[`img_alt_${im.id}`], 140) || dados.nome, inteiro(req.body[`img_ordem_${im.id}`], 1, 99, im.ordem), im.id);
      }
    }
  });
  await Promise.all(apagar.map(apagarImagem));
  await processaFotos(req, id, dados.nome);
  await auth.registrar(req.admin.id, 'editou produto', dados.nome, req);
  res.redirect(303, `/admin/produtos/${id}?aviso=ok`);
}));

r.post('/produtos/:id(\\d+)/alternar', formSimples, auth.confereCsrf, a(async (req, res) => {
  const campo = req.body.campo === 'destaque' ? 'destaque' : 'ativo';
  const id = Number(req.params.id);
  await db.run(`UPDATE products SET ${campo} = 1 - ${campo}, atualizado_em = datetime('now') WHERE id = ?`, id);
  const p = await db.get('SELECT nome FROM products WHERE id = ?', id);
  if (p) await auth.registrar(req.admin.id, campo === 'ativo' ? 'mudou visibilidade' : 'mudou destaque', p.nome, req);
  const ref = req.get('referer');
  res.redirect(303, ref && ref.includes('/admin/produtos') ? '/admin/produtos?' + new URL(ref).searchParams.toString() : '/admin/produtos');
}));

r.post('/produtos/:id(\\d+)/excluir', formSimples, auth.confereCsrf, a(async (req, res) => {
  const id = Number(req.params.id);
  const p = await db.get('SELECT nome FROM products WHERE id = ?', id);
  if (p) {
    const imgs = await db.all('SELECT arquivo FROM product_images WHERE product_id = ?', id);
    await transacao(async (t) => {
      for (const tab of ['variants', 'product_info', 'product_images']) await t.run(`DELETE FROM ${tab} WHERE product_id = ?`, id);
      await t.run('DELETE FROM products WHERE id = ?', id);
    });
    await Promise.all(imgs.map((i) => apagarImagem(i.arquivo)));
    await auth.registrar(req.admin.id, 'excluiu produto', p.nome, req);
  }
  res.redirect(303, '/admin/produtos?aviso=excluido');
}));

// ---------- categorias ----------
r.get('/categorias', a(async (req, res) => envia(res, V.listaCategorias({ admin: req.admin, cats: await cat.categorias({ todas: true }), aviso: avisoDe(req) }))));
r.get('/categorias/nova', (req, res) => envia(res, V.formCategoria({ admin: req.admin, c: { cor: 'verde', ativo: 1 } })));
r.get('/categorias/:id(\\d+)', a(async (req, res) => {
  const c = await db.get('SELECT * FROM categories WHERE id = ?', Number(req.params.id));
  if (!c) return res.redirect('/admin/categorias');
  envia(res, V.formCategoria({ admin: req.admin, c }));
}));

async function salvarCategoria(req, res, id) {
  const atual = id ? await db.get('SELECT * FROM categories WHERE id = ?', id) : null;
  const c = {
    nome: txt(req.body.nome, 60),
    descricao: txt(req.body.descricao, 300),
    cor: CORES[txt(req.body.cor, 10)] ? txt(req.body.cor, 10) : 'verde',
    ordem: inteiro(req.body.ordem, 0, 999),
    ativo: req.body.ativo ? 1 : 0,
  };
  if (!c.nome) return envia(res, V.formCategoria({ admin: req.admin, c: { ...atual, ...c }, erro: 'Dê um nome à categoria.' }), 400);
  c.slug = await slugLivre('categories', slugify(txt(req.body.slug, 80) || c.nome), id || 0);
  let arte = atual ? atual.arte : '';
  const arquivo = (req.files || []).find((f) => f.fieldname === 'arte');
  if (arquivo) {
    try {
      const nova = await salvarImagem(arquivo.buffer, 'categorias');
      if (arte) await apagarImagem(arte);
      arte = nova;
    } catch {
      return envia(res, V.formCategoria({ admin: req.admin, c: { ...atual, ...c }, erro: 'Não consegui ler essa imagem. Tente outro arquivo.' }), 400);
    }
  } else if (req.body.remover_arte && arte) {
    await apagarImagem(arte);
    arte = '';
  }
  if (id) {
    await db.run('UPDATE categories SET nome=?, slug=?, descricao=?, cor=?, ordem=?, ativo=?, arte=? WHERE id=?', c.nome, c.slug, c.descricao, c.cor, c.ordem, c.ativo, arte, id);
  } else {
    await db.run('INSERT INTO categories (nome, slug, descricao, cor, ordem, ativo, arte) VALUES (?, ?, ?, ?, ?, ?, ?)', c.nome, c.slug, c.descricao, c.cor, c.ordem, c.ativo, arte);
  }
  await auth.registrar(req.admin.id, id ? 'editou categoria' : 'criou categoria', c.nome, req);
  res.redirect(303, '/admin/categorias?aviso=ok');
}
r.post('/categorias/nova', upload.any(), auth.confereCsrf, a((req, res) => salvarCategoria(req, res, 0)));
r.post('/categorias/:id(\\d+)', upload.any(), auth.confereCsrf, a((req, res) => salvarCategoria(req, res, Number(req.params.id))));
r.post('/categorias/:id(\\d+)/excluir', formSimples, auth.confereCsrf, a(async (req, res) => {
  const c = await db.get('SELECT * FROM categories WHERE id = ?', Number(req.params.id));
  if (c) {
    await transacao(async (t) => {
      await t.run('UPDATE products SET categoria_id = NULL WHERE categoria_id = ?', c.id);
      await t.run('DELETE FROM categories WHERE id = ?', c.id);
    });
    if (c.arte) await apagarImagem(c.arte);
    await auth.registrar(req.admin.id, 'excluiu categoria', c.nome, req);
  }
  res.redirect(303, '/admin/categorias?aviso=excluido');
}));

// ---------- dados da loja ----------
r.get('/loja', a(async (req, res) => envia(res, V.formLoja({ admin: req.admin, cfg: await config(), aviso: avisoDe(req) }))));
r.post('/loja', formSimples, auth.confereCsrf, a(async (req, res) => {
  const cfg = {};
  for (const k of CHAVES_CONFIG) cfg[k] = txt(req.body[k], 2000).replace(/\r\n/g, '\n');
  if (cfg.mapa_link && !/^https:\/\//i.test(cfg.mapa_link)) {
    return envia(res, V.formLoja({ admin: req.admin, cfg, erro: 'O link do mapa precisa começar com https://' }), 400);
  }
  cfg.whatsapp = cfg.whatsapp.replace(/\D/g, '').slice(0, 15);
  if (cfg.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cfg.email)) {
    return envia(res, V.formLoja({ admin: req.admin, cfg, erro: 'E-mail inválido.' }), 400);
  }
  await transacao(async (t) => {
    for (const [k, v] of Object.entries(cfg)) await t.run('INSERT INTO settings (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', k, v);
  });
  await auth.registrar(req.admin.id, 'editou dados da loja', '', req);
  res.redirect(303, '/admin/loja?aviso=ok');
}));

// ---------- usuários ----------
const listaUsuarios = () => db.all('SELECT id, email, nome, ultimo_login FROM users ORDER BY email');
r.get('/usuarios', a(async (req, res) => envia(res, V.usuarios({ admin: req.admin, lista: await listaUsuarios(), aviso: avisoDe(req) }))));
r.post('/usuarios', formSimples, auth.confereCsrf, a(async (req, res) => {
  const email = txt(req.body.email, 120).toLowerCase();
  const senha = txt(req.body.senha, 200);
  const erro = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'E-mail inválido.'
    : (await db.get('SELECT 1 AS ok FROM users WHERE email = ?', email)) ? 'Esse e-mail já tem acesso.'
      : auth.senhaFraca(senha);
  if (erro) return envia(res, V.usuarios({ admin: req.admin, lista: await listaUsuarios(), erro }), 400);
  await db.run('INSERT INTO users (email, nome, senha_hash) VALUES (?, ?, ?)', email, txt(req.body.nome, 60), auth.hashSenha(senha));
  await auth.registrar(req.admin.id, 'criou acesso', email, req);
  res.redirect(303, '/admin/usuarios?aviso=criado');
}));
r.post('/usuarios/:id(\\d+)/excluir', formSimples, auth.confereCsrf, a(async (req, res) => {
  const id = Number(req.params.id);
  const u = await db.get('SELECT email FROM users WHERE id = ?', id);
  if (u && id !== req.admin.id) {
    await db.run('DELETE FROM sessions WHERE user_id = ?', id);
    await db.run('DELETE FROM users WHERE id = ?', id);
    await auth.registrar(req.admin.id, 'removeu acesso', u.email, req);
  }
  res.redirect(303, '/admin/usuarios?aviso=excluido');
}));

r.get('/conta', (req, res) => envia(res, V.conta({ admin: req.admin, aviso: avisoDe(req) })));
r.post('/conta', formSimples, auth.confereCsrf, a(async (req, res) => {
  const u = await db.get('SELECT senha_hash FROM users WHERE id = ?', req.admin.id);
  const nova = txt(req.body.nova, 200);
  const erro = !auth.confereSenha(txt(req.body.atual, 200), u.senha_hash) ? 'Senha atual incorreta.'
    : nova !== txt(req.body.nova2, 200) ? 'As senhas novas não são iguais.'
      : auth.senhaFraca(nova);
  if (erro) return envia(res, V.conta({ admin: req.admin, erro }), 400);
  await db.run('UPDATE users SET senha_hash = ? WHERE id = ?', auth.hashSenha(nova), req.admin.id);
  // derruba as outras sessões dessa pessoa
  await db.run('DELETE FROM sessions WHERE user_id = ? AND csrf <> ?', req.admin.id, req.admin.csrf);
  await auth.registrar(req.admin.id, 'trocou a senha', '', req);
  res.redirect(303, '/admin/conta?aviso=senha');
}));

r.get('/atividade', a(async (req, res) => {
  const lista2 = await db.all('SELECT a.*, u.email FROM activity a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300');
  envia(res, V.atividade({ admin: req.admin, lista: lista2 }));
}));

// erros de upload (arquivo grande demais etc.)
r.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Foto grande demais (máximo 4 MB). Tente uma foto menor.' : 'Envio inválido.';
    return res.status(400).type('html').send(String(V.base({ titulo: 'Erro', admin: req.admin, erro: msg, corpo: '<p><a class="btn btn-sec" href="/admin/produtos">Voltar aos produtos</a></p>' })));
  }
  next(err);
});

module.exports = r;
