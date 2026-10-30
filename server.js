// Planeta Animal Agropet — servidor do site e do painel.
// Local: npm start (porta 3000). Vercel: este arquivo exporta o app (veja vercel.json).
const path = require('node:path');
require('./src/env');

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { db, config, pronto } = require('./src/db');
const cat = require('./src/catalogo');
const P = require('./src/views/paginas');
const { urlImagem } = require('./src/imagens');
const { paraCentavos, ESPECIES } = require('./src/util');

const app = express();
const NA_VERCEL = Boolean(process.env.VERCEL);
const PRODUCAO = process.env.NODE_ENV === 'production' || NA_VERCEL;
app.disable('x-powered-by');
// Na Vercel há um proxy na frente: confiar nele para ler o IP real e saber que a conexão é HTTPS
const proxy = process.env.TRUST_PROXY || (NA_VERCEL ? '1' : '');
app.set('trust proxy', proxy ? Number(proxy) || proxy : false);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      // blob: = prévia das fotos no painel; vercel-storage = fotos cadastradas (Vercel Blob)
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.public.blob.vercel-storage.com'],
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

// arquivos estáticos (na Vercel a pasta public/ é servida pela CDN antes de chegar aqui)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: PRODUCAO ? '7d' : 0,
  setHeaders: (res, arq) => { if (/\.(woff2?|webp|svg|jpg)$/.test(arq) && PRODUCAO) res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); },
}));
// uploads locais: só as imagens WebP que nós mesmos geramos
app.use('/uploads', (req, res, next) => {
  if (!/^\/(produtos|categorias)\/[a-f0-9]{24}-\d+\.webp$/.test(req.path)) return res.status(404).end();
  next();
}, express.static(path.join(__dirname, 'uploads'), { maxAge: PRODUCAO ? '30d' : 0, index: false, dotfiles: 'deny' }));

// banco pronto (tabelas criadas) antes de qualquer página
app.use((req, res, next) => pronto().then(() => next(), next));

const envia = (res, conteudo, status = 200) => res.status(status).type('html').send(String(conteudo));
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// configuração da loja + categorias do menu (usadas em toda página)
async function contexto() {
  const [cfg, cats] = await Promise.all([config(), cat.categorias()]);
  cfg._cats = cats;
  return cfg;
}

// ---------- site público ----------
app.get('/', a(async (req, res) => {
  const cfg = await contexto();
  const [ofertas, destaques] = await Promise.all([cat.ofertas(10), cat.destaques(10)]);
  envia(res, P.home({ cfg, cats: cfg._cats, ofertas, destaques }));
}));

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

async function telaCatalogo(res, f, extra = {}) {
  const [cfg, res2, marcas] = await Promise.all([contexto(), cat.listar(f), cat.marcas()]);
  envia(res, P.catalogo({ cfg, res: res2, cats: cfg._cats, marcas, f, ...extra }));
}

app.get('/produtos', a(async (req, res) => {
  if (req.query.categoria) {
    const c = await db.get('SELECT slug FROM categories WHERE slug = ? AND ativo = 1', String(req.query.categoria).slice(0, 80));
    if (c) return res.redirect(301, `/categoria/${c.slug}`);
  }
  await telaCatalogo(res, lerFiltros(req.query));
}));

app.get('/ofertas', a((req, res) => telaCatalogo(res, { ...lerFiltros(req.query), ofertas: true }, { base: '/ofertas' })));

app.get('/categoria/:slug', a(async (req, res, next) => {
  const categoria = await db.get('SELECT * FROM categories WHERE slug = ? AND ativo = 1', String(req.params.slug).slice(0, 80));
  if (!categoria) return next();
  await telaCatalogo(res, { ...lerFiltros(req.query), categoria: categoria.slug }, { categoria, base: `/categoria/${categoria.slug}` });
}));

app.get('/produto/:slug', a(async (req, res, next) => {
  const p = await cat.produto(String(req.params.slug).slice(0, 80));
  if (!p) return next();
  const [cfg, rel] = await Promise.all([contexto(), cat.relacionados(p)]);
  envia(res, P.produto({ cfg, p, rel }));
}));

app.get('/a-loja', a(async (req, res) => envia(res, P.loja({ cfg: await contexto() }))));

// ---------- API pública (só leitura) ----------
const limiteApi = rateLimit({ windowMs: 60 * 1000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false });
app.get('/api/busca', limiteApi, a(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  if (q.length < 2) return res.json({ itens: [] });
  const { itens } = await cat.listar({ busca: q, limite: 6 });
  res.json({
    itens: itens.map((p) => ({ nome: p.nome, marca: p.marca, url: `/produto/${p.slug}`, img: urlImagem(p.capa, 480), preco: p.preco ? p.preco.efetivo : null })),
  });
}));

// Preços atuais das variantes da sacola (o navegador confere antes de fechar o pedido)
app.get('/api/variantes', limiteApi, a(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
  if (!ids.length) return res.json({ itens: [] });
  const linhas = await db.all(`SELECT v.id, v.rotulo, v.preco, v.preco_promo, v.estoque, p.nome, p.slug FROM variants v
    JOIN products p ON p.id = v.product_id WHERE p.ativo = 1 AND v.id IN (${ids.map(() => '?').join(',')})`, ...ids);
  res.json({ itens: linhas.map((v) => ({ id: v.id, nome: v.nome, rotulo: v.rotulo, preco: v.preco_promo && v.preco_promo < v.preco ? v.preco_promo : v.preco, estoque: v.estoque })) });
}));

// ---------- SEO ----------
app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nDisallow: /admin\nDisallow: /api\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`));
app.get('/sitemap.xml', a(async (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const [cats, prods] = await Promise.all([db.all('SELECT slug FROM categories WHERE ativo = 1'), db.all('SELECT slug FROM products WHERE ativo = 1')]);
  const urls = ['/', '/produtos', '/ofertas', '/a-loja', ...cats.map((c) => `/categoria/${c.slug}`), ...prods.map((p) => `/produto/${p.slug}`)];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${esc(base + u)}</loc></url>`).join('')}</urlset>`);
}));

// ---------- painel ----------
app.use('/admin', require('./src/admin/rotas'));

// ---------- 404 e erros ----------
app.use(a(async (req, res) => envia(res, P.erro({ cfg: await contexto(), codigo: 404 }), 404)));
app.use(async (err, req, res, _next) => {
  console.error(new Date().toISOString(), req.method, req.originalUrl, err);
  if (res.headersSent) return;
  try {
    envia(res, P.erro({ cfg: await contexto(), codigo: 500 }), 500);
  } catch {
    res.status(500).type('text').send('Erro interno. Tente de novo em instantes.');
  }
});

module.exports = app;

// Rodando direto (npm start) sobe o servidor; na Vercel quem chama o app é a plataforma.
if (require.main === module) {
  const PORTA = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '127.0.0.1';
  pronto().then(() => app.listen(PORTA, HOST, () => console.log(`Planeta Animal no ar em http://${HOST}:${PORTA}`)));
}
