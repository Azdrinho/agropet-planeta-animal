// Páginas públicas
const { html, cru, h, reais, paragrafos, linhas, ESPECIES, ESTOQUE, SELOS } = require('../util');
const { urlImagem, srcset } = require('../imagens');
const { layout, icone, linkWhats } = require('./layout');
const { card, grade, preco, seloDe } = require('./componentes');

const ARTE_CAT = {
  racoes: 'cat-racoes', petiscos: 'cat-petiscos', brinquedos: 'cat-brinquedos',
  acessorios: 'cat-acessorios', 'higiene-e-saude': 'cat-higiene', 'roca-e-criacao': 'cat-roca',
};
function arteCategoria(c) {
  if (c.arte) return urlImagem(c.arte, 960);
  return `/img/artes/${ARTE_CAT[c.slug] || 'cat-racoes'}.webp`;
}

// Título em Relaxe com letras que entram uma a uma (o JS anima)
const letras = (txt) => html`<span class="letras" aria-label="${txt}">${[...String(txt)].map((ch) => (ch === ' ' ? cru('<span class="esp"> </span>') : html`<span aria-hidden="true">${ch}</span>`))}</span>`;

const RACOES_VOANDO = [
  ['osso', 8, 18, -20, 1.2], ['rosca', 86, 12, 15, 1], ['tri', 78, 58, 40, .9], ['osso', 14, 64, 60, .8],
  ['rosca', 46, 8, -10, .7], ['tri', 92, 34, -30, 1.1], ['osso', 64, 80, 10, .9],
];
const RACAO_SVG = {
  osso: '<svg viewBox="-20 -14 40 28"><g><rect x="-13" y="-5" width="26" height="10" rx="5"/><circle cx="-13" cy="-5" r="6"/><circle cx="-13" cy="5" r="6"/><circle cx="13" cy="-5" r="6"/><circle cx="13" cy="5" r="6"/></g></svg>',
  rosca: '<svg viewBox="-14 -14 28 28"><path fill-rule="evenodd" d="M0-12a12 12 0 1 1 0 24a12 12 0 1 1 0-24zM0-4.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z"/></svg>',
  tri: '<svg viewBox="-16 -16 32 32"><path stroke-width="9" stroke-linejoin="round" d="M0-10L9 7H-9Z"/></svg>',
};
function racoes() {
  return cru(RACOES_VOANDO.map(([t, x, y, r, s], i) =>
    `<span class="racao" data-x="${x}" data-y="${y}" data-r="${r}" data-s="${s}" data-prof="${(i % 3) + 1}">${RACAO_SVG[t]}</span>`).join(''));
}

function home({ cfg, cats, ofertas, destaques }) {
  const titulo = (cfg.hero_titulo || 'Falou ração?').trim();
  const partes = titulo.split(/\s+/);
  const gigante = partes.length > 1 ? partes.pop() : titulo;
  const kicker = partes.length ? partes.join(' ') : '';
  const vitrine = ofertas.length ? ofertas : destaques;
  const insta = cfg.instagram ? `https://instagram.com/${cfg.instagram.replace(/^@/, '').replace(/[^\w.]/g, '')}` : '';
  const posts = ['post-01-falou-racao', 'post-07-produto-racao', 'post-03-nao-deu-pra-esperar', 'post-05-quem-manda', 'post-02-choveu-racao', 'post-09-produto-brinquedo'];
  const whats = linkWhats(cfg, 'Oi! Vim pelo site e queria tirar uma dúvida.');
  const corpo = html`
<section class="hero" data-hero>
  <div class="hero-palco" data-parallax>
    ${racoes()}
    ${kicker ? html`<p class="hero-kicker rx" data-camada="1">${kicker}</p>` : ''}
    <h1 class="hero-gigante rx" data-camada="2">${letras(gigante)}</h1>
    <img class="hero-pet" data-camada="3" src="/img/artes/hero-cao.webp" alt="Cão caramelo de bandana verde inclinando a cabeça" width="1120" height="1400" fetchpriority="high">
  </div>
  <div class="hero-txt">
    <p>${cfg.hero_texto}</p>
    <div class="hero-btns">
      <a class="btn btn-sol" href="/produtos" data-magnetico><span>Ver produtos</span>${icone('seta')}</a>
      <a class="btn btn-linha" href="/ofertas" data-magnetico><span>Ofertas da semana</span></a>
    </div>
  </div>
</section>

<div class="faixa" aria-hidden="true"><div class="faixa-trilho">${[0, 1].map(() => html`<span>ração</span><i>${icone('pata')}</i><span>petisco</span><i>${icone('pata')}</i><span>brinquedo</span><i>${icone('pata')}</i><span>acessório</span><i>${icone('pata')}</i><span>higiene</span><i>${icone('pata')}</i><span>roça</span><i>${icone('pata')}</i><span>do campo ao colo</span><i>${icone('pata')}</i>`)}</div></div>

<section class="secao" id="categorias">
  <header class="secao-topo" data-revela>
    <h2 class="rx">Tem de tudo<br>pro seu bicho.</h2>
    <a class="link-seta" href="/produtos">Ver todos os produtos ${icone('seta')}</a>
  </header>
  <div class="cats">
    ${cats.map((c, i) => html`<a class="cat cor-${c.cor}" href="/categoria/${c.slug}" data-revela data-i="${i}" data-tilt>
      <img src="${arteCategoria(c)}" alt="" loading="lazy" width="720" height="900">
      <span class="cat-nome rx">${c.nome}</span>
      <span class="cat-qtd">${c.total} ${c.total === 1 ? 'produto' : 'produtos'} ${icone('seta')}</span>
    </a>`)}
  </div>
</section>

${vitrine.length ? html`<section class="secao secao-ofertas">
  <div class="ofertas-topo" data-revela>
    <img src="/img/artes/esp-gatos.webp" alt="" loading="lazy" width="700" height="900">
    <div>
      <h2 class="rx">${ofertas.length ? 'Choveu oferta!' : 'Os queridinhos'}</h2>
      <p>${ofertas.length ? 'Preço bom enquanto durar o estoque. Corre que o Farofa já viu.' : 'Os produtos que mais saem da prateleira.'}</p>
      <a class="btn btn-sol" href="${ofertas.length ? '/ofertas' : '/produtos'}" data-magnetico><span>${ofertas.length ? 'Ver todas as ofertas' : 'Ver produtos'}</span>${icone('seta')}</a>
    </div>
  </div>
  <div class="trilho-cards" data-arrasta>${vitrine.map((p, i) => card(p, i))}</div>
</section>` : ''}

<section class="secao">
  <header class="secao-topo" data-revela><h2 class="rx">Pra quem é?</h2></header>
  <div class="especies">
    <a class="esp cor-terra" href="/produtos?especie=caes" data-revela data-i="0" data-tilt><span class="rx">Cães</span><img src="/img/artes/esp-caes.webp" alt="" loading="lazy" width="760" height="900"></a>
    <a class="esp cor-azul" href="/produtos?especie=gatos" data-revela data-i="1" data-tilt><span class="rx">Gatos</span><img src="/img/artes/esp-gatos.webp" alt="" loading="lazy" width="700" height="900"></a>
    <a class="esp cor-verde" href="/produtos?especie=roca" data-revela data-i="2" data-tilt><span class="rx">Roça</span><img src="/img/artes/cat-roca.webp" alt="" loading="lazy" width="720" height="900"></a>
  </div>
</section>

<section class="historia">
  <div class="historia-img" data-revela>
    <img src="/img/artes/cena-colo.webp" alt="Mãos de camisa xadrez erguendo um filhote de chapéu de palha contra o céu" loading="lazy" width="1400" height="1738">
    <p class="historia-gigante rx" aria-hidden="true">do campo<br>ao colo.</p>
  </div>
  <div class="historia-txt" data-revela>
    <h2 class="rx">${cfg.assinatura}</h2>
    ${paragrafos(cfg.sobre_texto)}
    <ul class="beneficios">
      <li><b class="rx">Conhece seu bicho</b><span>Atendimento de quem lembra o nome do pet.</span></li>
      <li><b class="rx">Retira ou recebe</b><span>${cfg.entrega_texto}</span></li>
      <li><b class="rx">Cidade e roça</b><span>Do sofá ao galinheiro, tem pra todo mundo.</span></li>
    </ul>
  </div>
</section>

<section class="secao mascotes" data-revela>
  <button type="button" class="mascote" data-mascote="farofa" aria-label="Farofa, o mascote, diz uma frase">
    <span class="balao" data-balao>Falou ração?</span>
    <img src="/img/marca/farofa-esperanca.svg" alt="Farofa" width="250" height="262" loading="lazy">
  </button>
  <div class="mascotes-txt">
    <h2 class="rx">Farofa e Paçoca</h2>
    <p>Os dois do nosso coração. Ele é otimista e guloso; ela é exigente e aprova (ou não) cada produto. Clica neles.</p>
  </div>
  <button type="button" class="mascote" data-mascote="pacoca" aria-label="Paçoca, a mascote, diz uma frase">
    <span class="balao" data-balao>Hmm. Avaliando.</span>
    <img src="/img/marca/pacoca-julgando.svg" alt="Paçoca" width="250" height="262" loading="lazy">
  </button>
</section>

<section class="secao">
  <header class="secao-topo" data-revela>
    <h2 class="rx">No feed</h2>
    ${insta ? html`<a class="link-seta" href="${insta}" target="_blank" rel="noopener">${cfg.instagram} ${icone('seta')}</a>` : ''}
  </header>
  <div class="feed">${posts.map((p, i) => html`<a class="feed-item" ${insta ? cru(`href="${h(insta)}" target="_blank" rel="noopener"`) : cru('href="/produtos"')} data-revela data-i="${i}" data-tilt><img src="/img/posts/${p}.webp" alt="Post da Planeta Animal" loading="lazy" width="540" height="675"></a>`)}</div>
</section>

<section class="secao visita">
  <div class="visita-card" data-revela>
    <h2 class="rx">Passa aqui!</h2>
    ${cfg.endereco ? html`<p class="com-icone">${icone('pino')}<span>${linhas(cfg.endereco)}${cfg.cidade ? html`<br>${cfg.cidade}` : ''}</span></p>` : html`<p>Endereço em breve.</p>`}
    ${cfg.horario ? html`<p class="com-icone">${icone('relogio')}<span>${linhas(cfg.horario)}</span></p>` : ''}
    <div class="hero-btns">
      ${cfg.mapa_link ? html`<a class="btn btn-verde" href="${cfg.mapa_link}" target="_blank" rel="noopener">Como chegar</a>` : ''}
      ${whats ? html`<a class="btn btn-linha-escura" href="${whats}" target="_blank" rel="noopener">${icone('whats')}<span>WhatsApp</span></a>` : ''}
    </div>
  </div>
  <div class="faq" data-revela>
    <h2 class="rx">Perguntas de tutor</h2>
    ${faq(cfg).map(([p, r]) => html`<details><summary>${p}</summary><div>${paragrafos(r)}</div></details>`)}
  </div>
</section>`;
  return layout({ cfg, corpo, pagina: 'home', canonico: '/' });
}

function faq(cfg) {
  return [
    ['Como faço o pedido?', 'Escolha os produtos, coloque na sacola e toque em "Finalizar no WhatsApp". A mensagem vai pronta com tudo o que você escolheu, e a gente confirma valores, estoque e entrega por lá.'],
    ['Vocês entregam?', cfg.entrega_texto],
    ['Quais as formas de pagamento?', cfg.pagamento_texto],
    ['O preço do site é o mesmo da loja?', 'Sim, mantemos o site atualizado. Se algum valor mudar, avisamos antes de fechar o pedido.'],
    ['Posso tirar dúvida sobre qual ração escolher?', 'Claro. Chama no WhatsApp com a idade, o porte e a rotina do seu bicho que a gente indica.'],
  ];
}

function filtrosUrl(f, muda) {
  const q = { ...f, ...muda };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '' || v === false || (k === 'pagina' && Number(v) <= 1)) continue;
    p.set(k, v === true ? '1' : String(v));
  }
  const s = p.toString();
  return '/produtos' + (s ? '?' + s : '');
}

function catalogo({ cfg, res, cats, marcas, f, categoria, base = '/produtos' }) {
  const titulo = categoria ? categoria.nome : f.ofertas ? 'Ofertas' : f.especie ? `Para ${ESPECIES[f.especie] ? ESPECIES[f.especie].toLowerCase() : 'todos'}` : f.busca ? `Busca: ${f.busca}` : 'Produtos';
  const fBase = { ...f, categoria: categoria ? categoria.slug : f.categoria };
  const corpo = html`
<section class="cat-topo ${categoria ? 'cor-' + categoria.cor : f.ofertas ? 'cor-sol' : 'cor-verde'}">
  <div>
    <nav class="migalhas" aria-label="Você está em"><a href="/">Início</a><span>/</span><a href="/produtos">Produtos</a>${categoria ? html`<span>/</span><span>${categoria.nome}</span>` : ''}</nav>
    <h1 class="rx">${titulo}</h1>
    ${categoria && categoria.descricao ? html`<p>${categoria.descricao}</p>` : html`<p>${res.total} ${res.total === 1 ? 'produto encontrado' : 'produtos encontrados'}</p>`}
  </div>
  <img src="${categoria ? arteCategoria(categoria) : f.ofertas ? '/img/artes/esp-gatos.webp' : '/img/artes/cat-racoes.webp'}" alt="" width="720" height="900">
</section>
<div class="chips" data-arrasta>
  <a href="/produtos" class="chip ${!categoria && !f.ofertas ? 'ativo' : ''}">Tudo</a>
  ${cats.map((c) => html`<a href="/categoria/${c.slug}" class="chip ${categoria && categoria.id === c.id ? 'ativo' : ''}">${c.nome}</a>`)}
  <a href="/ofertas" class="chip chip-sol ${f.ofertas ? 'ativo' : ''}">Ofertas</a>
</div>
<section class="catalogo">
  <form class="filtros" method="get" action="${base}" data-filtros>
    ${f.busca ? html`<input type="hidden" name="busca" value="${f.busca}">` : ''}
    ${f.ofertas && base === '/produtos' ? html`<input type="hidden" name="ofertas" value="1">` : ''}
    <h2 class="rx">Filtrar</h2>
    <fieldset>
      <legend>Pra quem</legend>
      <div class="pilulas">
        <label><input type="radio" name="especie" value="" ${!f.especie ? 'checked' : ''}><span>Todos</span></label>
        ${Object.entries(ESPECIES).filter(([k]) => k !== 'todos').map(([k, v]) => html`<label><input type="radio" name="especie" value="${k}" ${f.especie === k ? cru('checked') : ''}><span>${v}</span></label>`)}
      </div>
    </fieldset>
    ${marcas.length ? html`<label>Marca<select name="marca"><option value="">Todas</option>${marcas.map((m) => html`<option ${f.marca === m ? cru('selected') : ''}>${m}</option>`)}</select></label>` : ''}
    <fieldset class="faixa-preco">
      <legend>Preço (R$)</legend>
      <input type="number" name="min" min="0" step="1" inputmode="numeric" placeholder="de" value="${Number.isFinite(f.min) ? Math.round(f.min / 100) : ''}" aria-label="Preço mínimo">
      <input type="number" name="max" min="0" step="1" inputmode="numeric" placeholder="até" value="${Number.isFinite(f.max) ? Math.round(f.max / 100) : ''}" aria-label="Preço máximo">
    </fieldset>
    <label>Ordenar<select name="ordem">
      ${[['relevancia', 'Destaques'], ['menor-preco', 'Menor preço'], ['maior-preco', 'Maior preço'], ['nome', 'Nome'], ['novidades', 'Novidades']]
        .map(([v, t]) => html`<option value="${v}" ${f.ordem === v ? cru('selected') : ''}>${t}</option>`)}
    </select></label>
    <button class="btn btn-verde btn-largo" type="submit">Aplicar</button>
  </form>
  <div class="resultados">
    ${res.itens.length ? grade(res.itens) : html`<div class="vazio">
      <img src="/img/artes/flagra.webp" alt="" width="600" height="900" loading="lazy">
      <div><h2 class="rx">Quem, eu?</h2><p>Não achamos nada com esses filtros. Tenta outra busca ou chama a gente no WhatsApp.</p><a class="btn btn-verde" href="/produtos">Ver tudo</a></div>
    </div>`}
    ${res.paginas > 1 ? html`<nav class="paginas" aria-label="Páginas">
      ${Array.from({ length: res.paginas }, (_, i) => i + 1).map((n) => html`<a href="${categoria ? base + '?' + new URLSearchParams({ ...(f.especie ? { especie: f.especie } : {}), ...(f.marca ? { marca: f.marca } : {}), ...(f.ordem ? { ordem: f.ordem } : {}), pagina: n }).toString() : filtrosUrl(fBase, { pagina: n })}" ${n === res.pagina ? cru('aria-current="page"') : ''}>${n}</a>`)}
    </nav>` : ''}
  </div>
</section>`;
  return layout({ cfg, titulo, corpo, pagina: f.ofertas ? 'ofertas' : 'catalogo', descricao: categoria ? categoria.descricao : undefined });
}

function produto({ cfg, p, rel }) {
  const v0 = p.variantes.find((v) => v.estoque !== 'esgotado') || p.variantes[0];
  const selo = seloDe(p);
  const whats = linkWhats(cfg, `Oi! Tenho interesse em: ${p.nome}${p.marca ? ' (' + p.marca + ')' : ''}.`);
  const imgs = p.imagens.length ? p.imagens : [{ arquivo: '', alt: p.nome }];
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.nome, description: p.resumo || undefined,
    brand: p.marca ? { '@type': 'Brand', name: p.marca } : undefined,
    image: p.imagens.map((i) => urlImagem(i.arquivo, 1600)),
    offers: p.variantes.map((v) => ({
      '@type': 'Offer', priceCurrency: 'BRL', price: ((v.preco_promo && v.preco_promo < v.preco ? v.preco_promo : v.preco) / 100).toFixed(2),
      availability: v.estoque === 'esgotado' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', name: v.rotulo || undefined,
    })),
  };
  const corpo = html`
<nav class="migalhas migalhas-produto" aria-label="Você está em"><a href="/">Início</a><span>/</span><a href="/produtos">Produtos</a>${p.categoria_slug ? html`<span>/</span><a href="/categoria/${p.categoria_slug}">${p.categoria_nome}</a>` : ''}</nav>
<section class="produto" data-produto data-id="${p.id}" data-slug="${p.slug}" data-nome="${p.nome}" data-img="${urlImagem(p.capa, 480)}">
  <div class="galeria" data-galeria>
    <div class="galeria-main" data-zoom>
      ${selo ? html`<span class="selo selo-${selo}">${selo === 'esgotado' ? 'Esgotado' : SELOS[selo]}</span>` : ''}
      <img data-galeria-img src="${urlImagem(imgs[0].arquivo, 960)}" srcset="${srcset(imgs[0].arquivo)}" sizes="(max-width: 900px) 92vw, 46vw" alt="${imgs[0].alt || p.nome}" width="960" height="960">
    </div>
    ${imgs.length > 1 ? html`<div class="galeria-mini">${imgs.map((im, i) => html`<button type="button" data-galeria-mini="${urlImagem(im.arquivo, 960)}" data-srcset="${srcset(im.arquivo)}" data-alt="${im.alt || p.nome}" ${i === 0 ? cru('aria-current="true"') : ''} aria-label="Ver foto ${i + 1}"><img src="${urlImagem(im.arquivo, 480)}" alt="" width="120" height="120" loading="lazy"></button>`)}</div>` : ''}
  </div>
  <div class="produto-info">
    ${p.marca ? html`<p class="produto-marca">${p.marca}</p>` : ''}
    <h1 class="rx">${p.nome}</h1>
    ${p.resumo ? html`<p class="produto-resumo">${p.resumo}</p>` : ''}
    <div class="produto-preco" data-preco-box>${v0 ? precoVariante(v0) : html`<span class="preco-consulta">Sob consulta</span>`}</div>
    ${p.variantes.length > 1 ? html`<fieldset class="variantes"><legend>Escolha</legend><div class="pilulas">
      ${p.variantes.map((v) => html`<label class="${v.estoque === 'esgotado' ? 'esgotada' : ''}"><input type="radio" name="variante" value="${v.id}" data-rotulo="${v.rotulo}" data-preco="${v.preco}" data-promo="${v.preco_promo && v.preco_promo < v.preco ? v.preco_promo : ''}" data-estoque="${v.estoque}" ${v0 && v.id === v0.id ? cru('checked') : ''} ${v.estoque === 'esgotado' ? cru('disabled') : ''}><span>${v.rotulo || 'Padrão'}</span></label>`)}
    </div></fieldset>` : v0 ? html`<input type="hidden" name="variante" value="${v0.id}" data-rotulo="${v0.rotulo}" data-preco="${v0.preco}" data-promo="${v0.preco_promo && v0.preco_promo < v0.preco ? v0.preco_promo : ''}" data-estoque="${v0.estoque}">` : ''}
    <p class="estoque" data-estoque-txt>${v0 ? ESTOQUE[v0.estoque] : ''}</p>
    <div class="comprar">
      <div class="qtd" data-qtd><button type="button" data-menos aria-label="Diminuir">−</button><input type="number" value="1" min="1" max="99" inputmode="numeric" aria-label="Quantidade" data-qtd-campo><button type="button" data-mais aria-label="Aumentar">+</button></div>
      <button type="button" class="btn btn-sol btn-comprar" data-add-produto ${!v0 || p.esgotado ? cru('disabled') : ''} data-magnetico>${icone('sacola')}<span>${p.esgotado ? 'Esgotado' : 'Pôr na sacola'}</span></button>
    </div>
    ${whats ? html`<a class="btn btn-linha-escura btn-largo" href="${whats}" target="_blank" rel="noopener">${icone('whats')}<span>Tirar dúvida no WhatsApp</span></a>` : ''}
    <div class="entrega-box">
      <p><b>Retirada ou entrega:</b> ${cfg.entrega_texto}</p>
      <p><b>Pagamento:</b> ${cfg.pagamento_texto}</p>
    </div>
  </div>
</section>
<section class="abas" data-abas>
  <div class="abas-btns" role="tablist">
    <button type="button" role="tab" aria-selected="true" aria-controls="aba-desc" id="tab-desc">Descrição</button>
    ${p.info.length ? html`<button type="button" role="tab" aria-selected="false" aria-controls="aba-info" id="tab-info" tabindex="-1">Informações</button>` : ''}
    ${p.modo_uso ? html`<button type="button" role="tab" aria-selected="false" aria-controls="aba-uso" id="tab-uso" tabindex="-1">Como usar</button>` : ''}
  </div>
  <div class="aba" role="tabpanel" id="aba-desc" aria-labelledby="tab-desc">${p.descricao ? paragrafos(p.descricao) : html`<p>${p.resumo || 'Fale com a gente no WhatsApp para saber mais sobre este produto.'}</p>`}</div>
  ${p.info.length ? html`<div class="aba" role="tabpanel" id="aba-info" aria-labelledby="tab-info" hidden><dl class="ficha">${p.info.map((i) => html`<div><dt>${i.chave}</dt><dd>${i.valor}</dd></div>`)}</dl></div>` : ''}
  ${p.modo_uso ? html`<div class="aba" role="tabpanel" id="aba-uso" aria-labelledby="tab-uso" hidden>${paragrafos(p.modo_uso)}</div>` : ''}
</section>
${rel.length ? html`<section class="secao"><header class="secao-topo"><h2 class="rx">Combina com</h2></header>${grade(rel)}</section>` : ''}`;
  return layout({
    cfg, titulo: p.nome, descricao: p.resumo, corpo, pagina: 'produto', jsonld,
    imagemOg: p.capa ? urlImagem(p.capa, 960) : undefined, canonico: `/produto/${p.slug}`,
  });
}

function precoVariante(v) {
  const promo = v.preco_promo && v.preco_promo < v.preco;
  const ef = promo ? v.preco_promo : v.preco;
  const [inteiro, cent] = reais(ef).split(',');
  return html`${promo ? html`<s>R$ ${reais(v.preco)}</s>` : ''}<b><i>R$</i>${inteiro}<i>,${cent}</i></b>${promo ? html`<span class="economia">economize R$ ${reais(v.preco - v.preco_promo)}</span>` : ''}`;
}

function loja({ cfg }) {
  const whats = linkWhats(cfg, 'Oi! Vim pelo site da Planeta Animal.');
  const corpo = html`
<section class="loja-topo">
  <div class="loja-img"><img src="/img/artes/cena-galinha.webp" alt="Galinha orgulhosa com pintinhos sobre milho" width="1200" height="1490"></div>
  <div class="loja-txt">
    <h1 class="rx">A loja</h1>
    ${paragrafos(cfg.sobre_texto)}
    ${cfg.endereco ? html`<p class="com-icone">${icone('pino')}<span>${linhas(cfg.endereco)}${cfg.cidade ? html`<br>${cfg.cidade}` : ''}</span></p>` : ''}
    ${cfg.horario ? html`<p class="com-icone">${icone('relogio')}<span>${linhas(cfg.horario)}</span></p>` : ''}
    <div class="hero-btns">
      ${cfg.mapa_link ? html`<a class="btn btn-verde" href="${cfg.mapa_link}" target="_blank" rel="noopener">Como chegar</a>` : ''}
      ${whats ? html`<a class="btn btn-sol" href="${whats}" target="_blank" rel="noopener">${icone('whats')}<span>WhatsApp</span></a>` : ''}
    </div>
  </div>
</section>
<section class="secao loja-info">
  <div class="info-card cor-azul" data-revela><h2 class="rx">Entrega</h2>${paragrafos(cfg.entrega_texto)}</div>
  <div class="info-card cor-terra" data-revela data-i="1"><h2 class="rx">Pagamento</h2>${paragrafos(cfg.pagamento_texto)}</div>
  <div class="info-card cor-verde" data-revela data-i="2"><h2 class="rx">Como pedir</h2><p>Monte a sacola no site e finalize no WhatsApp. A gente confirma tudo e separa o seu pedido.</p></div>
</section>
<section class="secao"><div class="faq faq-largo">${faq(cfg).map(([p, r]) => html`<details><summary>${p}</summary><div>${paragrafos(r)}</div></details>`)}</div></section>`;
  return layout({ cfg, titulo: 'A loja', corpo, pagina: 'loja' });
}

function erro({ cfg, codigo = 404 }) {
  const corpo = html`<section class="erro">
    <img src="/img/artes/flagra.webp" alt="" width="600" height="900">
    <div>
      <p class="erro-cod rx">${codigo}</p>
      <h1 class="rx">${codigo === 404 ? 'Quem, eu?' : 'Opa, tropeçamos.'}</h1>
      <p>${codigo === 404 ? 'Essa página sumiu igual ração boa. Bora voltar?' : 'Algo deu errado do nosso lado. Tenta de novo em instantes.'}</p>
      <a class="btn btn-sol" href="/">Voltar ao início</a>
    </div>
  </section>`;
  return layout({ cfg, titulo: codigo === 404 ? 'Página não encontrada' : 'Erro', corpo, pagina: 'erro' });
}

module.exports = { home, catalogo, produto, loja, erro, precoVariante };
