// Planeta Animal Agropet — servidor do site e do painel.
// npm start   (porta padrão 3000; veja .env.example)
const path = require('node:path');
const fs = require('node:fs');

// .env simples (sem dependência): CHAVE=valor por linha
const envArq = path.join(__dirname, '.env');
if (fs.existsSync(envArq)) {
  for (const linha of fs.readFileSync(envArq, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { db, config } = require('./src/db');
const cat = require('./src/catalogo');
const P = require('./src/views/paginas');
const { urlImagem } = require('./src/imagens');
const { paraCentavos, ESPECIES } = require('./src/util');

const app = express();
const PRODUCAO = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : false);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'], // blob: = prévia das fotos antes do envio no painel
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      ...(PRODUCAO ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  crossOriginEmbedderPolicy: false,
  strictTransportSecurity: PRODUCAO ? { maxAge: 31536000, includeSubDomains: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// limite geral contra abuso (generoso para navegação normal)
app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

// arquivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: PRODUCAO ? '7d' : 0,
  setHeaders: (res, arq) => { if (/\.(woff2?|webp|svg|jpg)$/.test(arq) && PRODUCAO) res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); },
}));
// uploads: só as imagens WebP que nós mesmos geramos
app.use('/uploads', (req, res, next) => {
  if (!/^\/(produtos|categorias)\/[a-f0-9]{24}-\d+\.webp$/.test(req.path)) return res.status(404).end();
  next();
}, express.static(path.join(__dirname, 'uploads'), { maxAge: PRODUCAO ? '30d' : 0, index: false, dotfiles: 'deny' }));

const envia = (res, conteudo, status = 200) => res.status(status).type('html').send(String(conteudo));

// ---------- site público ----------
app.get('/', (req, res) => {
  const cfg = config();
  envia(res, P.home({ cfg, cats: cat.categorias(), ofertas: cat.ofertas(10), destaques: cat.destaques(10) }));
});

function lerFiltros(q) {
  const s = (v, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const reais = (v) => { const c = paraCentavos(s(v, 12)); return c === null ? undefined : c; };
  return {
    busca: s(q.busca),
    especie: ESPECIES[s(q.especie, 10)] ? s(q.especie, 10) : '',
    marca: s(q.marca),
    ordem: s(q.ordem, 20),
    ofertas: q.ofertas === '1',
    min: reais(q.min),
    max: reais(q.max),
    pagina: Number(q.pagina) || 1,
  };
}

app.get('/produtos', (req, res) => {
  const cfg = config();
  const f = lerFiltros(req.query);
  const categoria = req.query.categoria ? db.prepare('SELECT * FROM categories WHERE slug = ? AND ativo = 1').get(String(req.query.categoria).slice(0, 80)) : null;
  if (categoria) return res.redirect(301, `/categoria/${categoria.slug}`);
  const res2 = cat.listar(f);
  envia(res, P.catalogo({ cfg, res: res2, cats: cat.categorias(), marcas: cat.marcas(), f }));
});

app.get('/ofertas', (req, res) => {
  const cfg = config();
  const f = { ...lerFiltros(req.query), ofertas: true };
  envia(res, P.catalogo({ cfg, res: cat.listar(f), cats: cat.categorias(), marcas: cat.marcas(), f, base: '/ofertas' }));
});

app.get('/categoria/:slug', (req, res, next) => {
  const categoria = db.prepare('SELECT * FROM categories WHERE slug = ? AND ativo = 1').get(String(req.params.slug).slice(0, 80));
  if (!categoria) return next();
  const cfg = config();
  const f = { ...lerFiltros(req.query), categoria: categoria.slug };
  envia(res, P.catalogo({ cfg, res: cat.listar(f), cats: cat.categorias(), marcas: cat.marcas(), f, categoria, base: `/categoria/${categoria.slug}` }));
});

app.get('/produto/:slug', (req, res, next) => {
  const p = cat.produto(String(req.params.slug).slice(0, 80));
  if (!p) return next();
  envia(res, P.produto({ cfg: config(), p, rel: cat.relacionados(p) }));
});

app.get('/a-loja', (req, res) => envia(res, P.loja({ cfg: config() })));

// ---------- API pública (só leitura) ----------
const limiteApi = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false });
app.get('/api/busca', limiteApi, (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  if (q.length < 2) return res.json({ itens: [] });
  const { itens } = cat.listar({ busca: q, limite: 6 });
  res.json({
    itens: itens.map((p) => ({ nome: p.nome, marca: p.marca, url: `/produto/${p.slug}`, img: urlImagem(p.capa, 480), preco: p.preco ? p.preco.efetivo : null })),
  });
});

// Preços atuais das variantes da sacola (o navegador confere antes de fechar o pedido)
app.get('/api/variantes', limiteApi, (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
  if (!ids.length) return res.json({ itens: [] });
  const linhas = db.prepare(`SELECT v.id, v.rotulo, v.preco, v.preco_promo, v.estoque, p.nome, p.slug FROM variants v
    JOIN products p ON p.id = v.product_id WHERE p.ativo = 1 AND v.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  res.json({ itens: linhas.map((v) => ({ id: v.id, nome: v.nome, rotulo: v.rotulo, preco: v.preco_promo && v.preco_promo < v.preco ? v.preco_promo : v.preco, estoque: v.estoque })) });
});

// ---------- SEO ----------
app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = ['/', '/produtos', '/ofertas', '/a-loja',
    ...db.prepare('SELECT slug FROM categories WHERE ativo = 1').all().map((c) => `/categoria/${c.slug}`),
    ...db.prepare('SELECT slug FROM products WHERE ativo = 1').all().map((p) => `/produto/${p.slug}`)];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`);
});

// ---------- painel ----------
app.use('/admin', require('./src/admin/rotas'));

// ---------- 404 e erros ----------
app.use((req, res) => envia(res, P.erro({ cfg: config(), codigo: 404 }), 404));
app.use((err, req, res, _next) => {
  console.error(new Date().toISOString(), req.method, req.originalUrl, err);
  if (res.headersSent) return;
  try {
    envia(res, P.erro({ cfg: config(), codigo: 500 }), 500);
  } catch {
    res.status(500).send('Erro interno.');
  }
});

const PORTA = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORTA, HOST, () => console.log(`Planeta Animal no ar em http://${HOST}:${PORTA}`));
