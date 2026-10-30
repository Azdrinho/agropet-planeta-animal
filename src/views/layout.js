// Layout do site público: cabeçalho, sacola (gaveta), rodapé. Sem script inline (CSP).
const { html, cru, h, linhas, soDigitos, VERSAO } = require('../util');

const ICONES = {
  sacola: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
  busca: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.6-4.6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  whats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.3a8.5 8.5 0 1 1 15.4-4.6z"/><path d="M9 8.6c.3 2.9 3 5.6 6 6l1.1-1.4-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z"/></svg>',
  insta: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/></svg>',
  pino: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  pata: '<svg viewBox="0 0 24 24" aria-hidden="true" class="pata"><ellipse cx="12" cy="15.5" rx="4.6" ry="4"/><ellipse cx="6.2" cy="10" rx="1.9" ry="2.4"/><ellipse cx="9.6" cy="6.6" rx="1.9" ry="2.5"/><ellipse cx="14.4" cy="6.6" rx="1.9" ry="2.5"/><ellipse cx="17.8" cy="10" rx="1.9" ry="2.4"/></svg>',
};
const icone = (n) => cru(ICONES[n]);

function linkWhats(cfg, texto) {
  const num = soDigitos(cfg.whatsapp);
  if (!num) return '';
  return `https://wa.me/${num.length <= 11 ? '55' + num : num}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

function layout({ cfg, titulo, descricao, corpo, pagina = '', imagemOg, jsonld, canonico, tema = '' }) {
  const cats = cfg._cats || []; // o servidor carrega as categorias junto com a configuração
  const nomeLoja = cfg.loja_nome || 'Planeta Animal Agropet';
  const tituloCompleto = titulo ? `${titulo} · ${nomeLoja}` : `${nomeLoja} · ${cfg.assinatura || ''}`;
  const desc = descricao || cfg.hero_texto || '';
  const whats = linkWhats(cfg, 'Oi! Vim pelo site da Planeta Animal.');
  const insta = cfg.instagram ? `https://instagram.com/${cfg.instagram.replace(/^@/, '').replace(/[^\w.]/g, '')}` : '';
  return html`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tituloCompleto}</title>
<meta name="description" content="${desc}">
<meta name="theme-color" content="#3EAA1C">
${canonico ? cru(`<link rel="canonical" href="${h(canonico)}">`) : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${tituloCompleto}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${imagemOg || '/img/artes/og.jpg'}">
<link rel="icon" href="/img/marca/agropet-simbolo.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/Relaxe.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/Aminute.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css?v=${VERSAO}">
${jsonld ? cru(`<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`) : ''}
<script src="/js/site.js?v=${VERSAO}" defer></script>
</head>
<body class="pg-${pagina} ${tema}" data-whats="${soDigitos(cfg.whatsapp)}" data-loja="${nomeLoja}">
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
${cfg.aviso_topo ? html`<div class="aviso"><div class="aviso-trilho">${[0, 1, 2, 3].map(() => html`<span>${cfg.aviso_topo}</span><i>${icone('pata')}</i>`)}</div></div>` : ''}
<header class="topo" data-topo>
  <a class="topo-logo" href="/" aria-label="${nomeLoja} — início"><img src="/img/marca/agropet-logo-horizontal.svg" alt="${nomeLoja}" width="220" height="62"></a>
  <nav class="topo-nav" aria-label="Principal">
    <a href="/produtos" ${pagina === 'catalogo' ? cru('aria-current="page"') : ''}>Produtos</a>
    <div class="topo-cats">
      <button type="button" class="topo-cats-btn" aria-expanded="false" aria-controls="menu-cats">Categorias</button>
      <div class="topo-cats-menu" id="menu-cats">
        ${cats.map((c) => html`<a href="/categoria/${c.slug}" class="cor-${c.cor}"><span>${c.nome}</span><small>${c.total} ${c.total === 1 ? 'produto' : 'produtos'}</small></a>`)}
      </div>
    </div>
    <a href="/ofertas" class="topo-oferta" ${pagina === 'ofertas' ? cru('aria-current="page"') : ''}>Ofertas</a>
    <a href="/a-loja" ${pagina === 'loja' ? cru('aria-current="page"') : ''}>A loja</a>
  </nav>
  <div class="topo-acoes">
    <button type="button" class="btn-icone" data-abre-busca aria-label="Buscar produtos">${icone('busca')}</button>
    <button type="button" class="btn-icone btn-sacola" data-abre-sacola aria-label="Abrir sacola">${icone('sacola')}<b class="sacola-qtd" data-sacola-qtd hidden>0</b></button>
    <button type="button" class="btn-icone btn-menu" data-abre-menu aria-label="Abrir menu" aria-expanded="false">${icone('menu')}</button>
  </div>
</header>

<div class="menu-movel" data-menu hidden>
  <nav aria-label="Menu">
    <a href="/produtos">Produtos</a>
    ${cats.map((c) => html`<a href="/categoria/${c.slug}" class="sub">${c.nome}</a>`)}
    <a href="/ofertas">Ofertas</a>
    <a href="/a-loja">A loja</a>
  </nav>
</div>

<main id="conteudo">${corpo}</main>

<footer class="rodape">
  <section class="rodape-cta">
    <img class="rodape-mascote" src="/img/marca/farofa-esperanca.svg" alt="" width="250" height="262" loading="lazy">
    <div>
      <h2 class="rx">Bora pedir?</h2>
      <p>Monte a sacola no site e finalize com a gente no WhatsApp. Simples assim.</p>
    </div>
    ${whats ? html`<a class="btn btn-sol" href="${whats}" target="_blank" rel="noopener">${icone('whats')}<span>Chamar no WhatsApp</span></a>` : ''}
  </section>
  <div class="rodape-grade">
    <div class="rodape-marca">
      <img src="/img/marca/agropet-logo-branco-vertical.svg" alt="${nomeLoja}" width="200" height="150" loading="lazy">
      <p class="rx">${cfg.assinatura}</p>
    </div>
    <div>
      <h3>Categorias</h3>
      <ul>${cats.map((c) => html`<li><a href="/categoria/${c.slug}">${c.nome}</a></li>`)}</ul>
    </div>
    <div>
      <h3>A loja</h3>
      ${cfg.endereco ? html`<p class="com-icone">${icone('pino')}<span>${linhas(cfg.endereco)}${cfg.cidade ? html`<br>${cfg.cidade}` : ''}</span></p>` : ''}
      ${cfg.horario ? html`<p class="com-icone">${icone('relogio')}<span>${linhas(cfg.horario)}</span></p>` : ''}
    </div>
    <div>
      <h3>Fale com a gente</h3>
      <ul>
        ${whats ? html`<li><a href="${whats}" target="_blank" rel="noopener">WhatsApp ${cfg.telefone || ''}</a></li>` : ''}
        ${cfg.email ? html`<li><a href="mailto:${cfg.email}">${cfg.email}</a></li>` : ''}
        ${insta ? html`<li><a href="${insta}" target="_blank" rel="noopener">${cfg.instagram}</a></li>` : ''}
        <li><a href="/a-loja">Entrega e pagamento</a></li>
      </ul>
    </div>
  </div>
  <p class="rodape-fim">© ${new Date().getFullYear()} ${nomeLoja}. Preços e disponibilidade confirmados no atendimento.</p>
</footer>

<div class="sacola" data-sacola hidden>
  <div class="sacola-fundo" data-fecha-sacola></div>
  <aside class="sacola-painel" role="dialog" aria-modal="true" aria-labelledby="sacola-titulo">
    <header>
      <h2 id="sacola-titulo" class="rx">Sua sacola</h2>
      <button type="button" class="btn-icone" data-fecha-sacola aria-label="Fechar sacola">${icone('fechar')}</button>
    </header>
    <div class="sacola-itens" data-sacola-itens></div>
    <div class="sacola-vazia" data-sacola-vazia>
      <img src="/img/marca/pacoca-julgando.svg" alt="" width="160" height="168">
      <p class="rx">Sacola vazia?</p>
      <p>A Paçoca não aprova. Bora escolher alguma coisa?</p>
      <a class="btn btn-verde" href="/produtos">Ver produtos</a>
    </div>
    <form class="sacola-fechar" data-sacola-form novalidate>
      <div class="sacola-total"><span>Subtotal</span><strong data-sacola-total>R$ 0,00</strong></div>
      <p class="mini">Frete e valores finais confirmados no WhatsApp.</p>
      <label>Seu nome<input name="nome" autocomplete="name" maxlength="60" required></label>
      <fieldset class="opcoes">
        <legend>Como prefere receber?</legend>
        <label><input type="radio" name="entrega" value="retirar" checked><span>Retiro na loja</span></label>
        <label><input type="radio" name="entrega" value="entregar"><span>Entrega em casa</span></label>
      </fieldset>
      <label data-endereco hidden>Endereço de entrega<input name="endereco" autocomplete="street-address" maxlength="160"></label>
      <label>Pagamento<select name="pagamento"><option>Pix</option><option>Cartão de crédito</option><option>Cartão de débito</option><option>Dinheiro</option></select></label>
      <label>Observação<input name="obs" maxlength="200" placeholder="Ex.: troco para 100"></label>
      <button class="btn btn-sol btn-largo" type="submit">${icone('whats')}<span>Finalizar no WhatsApp</span></button>
      <p class="mini erro" data-sacola-erro hidden></p>
    </form>
  </aside>
</div>

<div class="busca" data-busca hidden>
  <div class="busca-caixa" role="dialog" aria-modal="true" aria-label="Buscar produtos">
    <form action="/produtos" method="get" role="search">
      ${icone('busca')}
      <input type="search" name="busca" placeholder="Ração, petisco, coleira…" autocomplete="off" data-busca-campo aria-label="O que você procura?" maxlength="60">
      <button type="button" class="btn-icone" data-fecha-busca aria-label="Fechar busca">${icone('fechar')}</button>
    </form>
    <div class="busca-res" data-busca-res aria-live="polite"></div>
  </div>
</div>
<div class="toast" data-toast role="status" aria-live="polite"></div>
</body>
</html>`;
}

module.exports = { layout, icone, linkWhats };
