const { html, reais, SELOS } = require('../util');
const { urlImagem, srcset } = require('../imagens');
const { icone } = require('./layout');

function preco(p) {
  if (!p.preco) return html`<span class="preco-consulta">Sob consulta</span>`;
  return html`<span class="preco">
    ${p.varios_precos ? html`<small>a partir de</small>` : ''}
    ${p.preco.promo ? html`<s>R$ ${reais(p.preco.cheio)}</s>` : ''}
    <b><i>R$</i>${reais(p.preco.efetivo).replace(/,\d+$/, '')}<i>,${reais(p.preco.efetivo).split(',')[1]}</i></b>
  </span>`;
}

function seloDe(p) {
  if (p.esgotado) return 'esgotado';
  if (p.selo) return p.selo;
  if (p.variantes.some((v) => v.preco_promo && v.preco_promo < v.preco && v.estoque !== 'esgotado')) return 'oferta';
  return '';
}

function card(p, i = 0) {
  const selo = seloDe(p);
  const unica = p.variantes.length === 1 && !p.esgotado ? p.variantes[0] : null;
  return html`<article class="card" data-revela data-i="${i % 8}">
  <a class="card-link" href="/produto/${p.slug}" aria-label="${p.nome}">
    <div class="card-img">
      ${selo ? html`<span class="selo selo-${selo}">${selo === 'esgotado' ? 'Esgotado' : SELOS[selo]}</span>` : ''}
      <img src="${urlImagem(p.capa, 480)}" srcset="${srcset(p.capa)}" sizes="(max-width: 700px) 50vw, 300px" alt="${(p.imagens[0] && p.imagens[0].alt) || p.nome}" loading="lazy" width="480" height="480">
      ${p.capa2 ? html`<img class="card-img2" src="${urlImagem(p.capa2, 480)}" alt="" loading="lazy" width="480" height="480">` : ''}
    </div>
    <div class="card-txt">
      ${p.marca ? html`<span class="card-marca">${p.marca}</span>` : ''}
      <h3>${p.nome}</h3>
      ${preco(p)}
    </div>
  </a>
  ${unica
    ? html`<button type="button" class="card-add" data-add data-id="${p.id}" data-variante="${unica.id}" data-nome="${p.nome}" data-rotulo="${unica.rotulo}" data-preco="${unica.preco_promo && unica.preco_promo < unica.preco ? unica.preco_promo : unica.preco}" data-img="${urlImagem(p.capa, 480)}" data-slug="${p.slug}" aria-label="Adicionar ${p.nome} à sacola">+</button>`
    : html`<a class="card-add card-escolher" href="/produto/${p.slug}" aria-label="Escolher opção de ${p.nome}">${icone('seta')}</a>`}
</article>`;
}

function grade(lista) {
  return html`<div class="grade">${lista.map((p, i) => card(p, i))}</div>`;
}

module.exports = { card, grade, preco, seloDe };
