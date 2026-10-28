// Telas do painel administrativo
const { html, cru, reais, ESPECIES, SELOS, ESTOQUE, CORES, VERSAO } = require('../util');
const { urlImagem } = require('../imagens');

const MENU = [
  ['painel', '/admin', 'Painel'],
  ['produtos', '/admin/produtos', 'Produtos'],
  ['categorias', '/admin/categorias', 'Categorias'],
  ['loja', '/admin/loja', 'Dados da loja'],
  ['usuarios', '/admin/usuarios', 'Usuários'],
  ['atividade', '/admin/atividade', 'Atividade'],
];

function base({ titulo, corpo, admin, atual = '', aviso = '', erro = '' }) {
  return html`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${titulo} · Painel Planeta Animal</title>
<link rel="icon" href="/img/marca/agropet-simbolo.svg" type="image/svg+xml">
<link rel="stylesheet" href="/css/admin.css?v=${VERSAO}">
<script src="/js/relaxe.js?v=${VERSAO}" defer></script>
<script src="/js/admin.js?v=${VERSAO}" defer></script>
</head>
<body class="${admin ? 'com-menu' : 'sem-menu'}">
${admin ? html`<aside class="lateral">
  <a class="lateral-logo" href="/admin"><img src="/img/marca/agropet-logo-horizontal.svg" alt="Planeta Animal" width="180" height="50"></a>
  <nav>${MENU.map(([k, href, nome]) => html`<a href="${href}" ${atual === k ? cru('aria-current="page"') : ''}>${nome}</a>`)}</nav>
  <div class="lateral-pe">
    <a href="/" target="_blank" rel="noopener">Ver o site ↗</a>
    <a href="/admin/conta">Minha senha</a>
    <form method="post" action="/admin/sair"><input type="hidden" name="_csrf" value="${admin.csrf}"><button type="submit">Sair</button></form>
    <small>${admin.email}</small>
  </div>
</aside>` : ''}
<main class="conteudo">
  ${aviso ? html`<p class="alerta ok" role="status">${aviso}</p>` : ''}
  ${erro ? html`<p class="alerta erro" role="alert">${erro}</p>` : ''}
  ${corpo}
</main>
</body>
</html>`;
}

const csrf = (a) => html`<input type="hidden" name="_csrf" value="${a.csrf}">`;

function entrar({ erro, email = '' }) {
  return base({
    titulo: 'Entrar', erro, corpo: html`<form class="login" method="post" action="/admin/entrar">
    <img src="/img/marca/agropet-logo-vertical.svg" alt="Planeta Animal Agropet" width="220" height="170">
    <h1>Painel da loja</h1>
    <label>E-mail<input type="email" name="email" value="${email}" autocomplete="username" required maxlength="120" autofocus></label>
    <label>Senha<input type="password" name="senha" autocomplete="current-password" required maxlength="200"></label>
    <button class="btn" type="submit">Entrar</button>
  </form>`,
  });
}

function painel({ admin, n, semFoto, semPreco, atividade, aviso }) {
  return base({
    titulo: 'Painel', admin, atual: 'painel', aviso, corpo: html`
<header class="cab"><h1>Olá${admin.nome ? ', ' + admin.nome : ''}!</h1><a class="btn" href="/admin/produtos/novo">+ Novo produto</a></header>
<div class="numeros">
  <a href="/admin/produtos"><b>${n.ativos}</b><span>produtos no site</span></a>
  <a href="/admin/produtos?status=inativos"><b>${n.inativos}</b><span>escondidos</span></a>
  <a href="/admin/produtos?status=ofertas"><b>${n.ofertas}</b><span>em oferta</span></a>
  <a href="/admin/categorias"><b>${n.categorias}</b><span>categorias</span></a>
</div>
<div class="duas">
  <section class="caixa">
    <h2>Precisa de atenção</h2>
    ${!semFoto.length && !semPreco.length ? html`<p class="calmo">Tudo certo por aqui.</p>` : ''}
    ${semFoto.length ? html`<h3>Sem foto</h3><ul class="lista-simples">${semFoto.map((p) => html`<li><a href="/admin/produtos/${p.id}">${p.nome}</a></li>`)}</ul>` : ''}
    ${semPreco.length ? html`<h3>Sem preço</h3><ul class="lista-simples">${semPreco.map((p) => html`<li><a href="/admin/produtos/${p.id}">${p.nome}</a></li>`)}</ul>` : ''}
  </section>
  <section class="caixa">
    <h2>Últimas alterações</h2>
    <ul class="lista-simples">${atividade.map((a) => html`<li><span>${a.acao}</span> <em>${a.alvo}</em><small>${a.em} · ${a.email || '—'}</small></li>`)}</ul>
  </section>
</div>`,
  });
}

function listaProdutos({ admin, itens, f, cats, aviso }) {
  return base({
    titulo: 'Produtos', admin, atual: 'produtos', aviso, corpo: html`
<header class="cab"><h1>Produtos</h1><a class="btn" href="/admin/produtos/novo">+ Novo produto</a></header>
<form class="barra" method="get">
  <input type="search" name="q" value="${f.q || ''}" placeholder="Buscar por nome ou marca" maxlength="60">
  <select name="cat"><option value="">Todas as categorias</option>${cats.map((c) => html`<option value="${c.id}" ${String(f.cat) === String(c.id) ? cru('selected') : ''}>${c.nome}</option>`)}</select>
  <select name="status">${[['', 'Todos'], ['ativos', 'No site'], ['inativos', 'Escondidos'], ['ofertas', 'Em oferta'], ['destaques', 'Destaques']].map(([v, t]) => html`<option value="${v}" ${f.status === v ? cru('selected') : ''}>${t}</option>`)}</select>
  <button class="btn btn-sec" type="submit">Filtrar</button>
</form>
<div class="tabela-wrap"><table class="tabela">
  <thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>No site</th><th>Destaque</th><th></th></tr></thead>
  <tbody>
  ${itens.length ? itens.map((p) => html`<tr>
    <td><img class="mini" src="${urlImagem(p.capa, 480)}" alt="" width="56" height="56" loading="lazy"></td>
    <td><a href="/admin/produtos/${p.id}"><b>${p.nome}</b></a><small>${p.marca}${p.variantes.length > 1 ? ` · ${p.variantes.length} opções` : ''}</small></td>
    <td>${p.categoria_nome || '—'}</td>
    <td>${p.preco ? html`${p.preco.promo ? html`<s>R$ ${reais(p.preco.cheio)}</s> ` : ''}R$ ${reais(p.preco.efetivo)}` : html`<em>sem preço</em>`}</td>
    <td>${alternar(admin, p.id, 'ativo', p.ativo)}</td>
    <td>${alternar(admin, p.id, 'destaque', p.destaque)}</td>
    <td><a class="btn btn-sec btn-peq" href="/admin/produtos/${p.id}">Editar</a></td>
  </tr>`) : html`<tr><td colspan="7" class="calmo">Nenhum produto encontrado.</td></tr>`}
  </tbody>
</table></div>`,
  });
}

function alternar(admin, id, campo, valor) {
  return html`<form method="post" action="/admin/produtos/${id}/alternar" class="alterna">${csrf(admin)}<input type="hidden" name="campo" value="${campo}">
    <button type="submit" class="chave ${valor ? 'ligada' : ''}" aria-pressed="${valor ? 'true' : 'false'}" aria-label="${campo === 'ativo' ? 'Mostrar no site' : 'Destaque'}"><span></span></button></form>`;
}

function formProduto({ admin, p, cats, marcas, erro, aviso }) {
  const novo = !p.id;
  const vars = p.variantes && p.variantes.length ? p.variantes : [{ rotulo: '', preco: '', preco_promo: '', sku: '', estoque: 'disponivel' }];
  const info = p.info && p.info.length ? p.info : [{ chave: '', valor: '' }];
  const preco = (c) => (c === null || c === undefined || c === '' ? '' : reais(c));
  return base({
    titulo: novo ? 'Novo produto' : p.nome, admin, atual: 'produtos', erro, aviso, corpo: html`
<header class="cab"><h1>${novo ? 'Novo produto' : 'Editar produto'}</h1>${!novo && p.ativo ? html`<a class="btn btn-sec" href="/produto/${p.slug}" target="_blank" rel="noopener">Ver no site ↗</a>` : ''}</header>
<form class="form" method="post" enctype="multipart/form-data" action="${novo ? '/admin/produtos/novo' : `/admin/produtos/${p.id}`}" data-protege>
  ${csrf(admin)}
  <div class="duas-col">
    <section class="caixa">
      <h2>O básico</h2>
      <label>Nome do produto *<input name="nome" value="${p.nome || ''}" required maxlength="140" data-gera-slug></label>
      <div class="lado">
        <label>Marca<input name="marca" value="${p.marca || ''}" maxlength="60" list="marcas"></label>
        <label>Categoria<select name="categoria_id"><option value="">Sem categoria</option>${cats.map((c) => html`<option value="${c.id}" ${String(p.categoria_id) === String(c.id) ? cru('selected') : ''}>${c.nome}</option>`)}</select></label>
      </div>
      <datalist id="marcas">${marcas.map((m) => html`<option value="${m}">`)}</datalist>
      <div class="lado">
        <label>Pra quem<select name="especie">${Object.entries(ESPECIES).map(([k, v]) => html`<option value="${k}" ${p.especie === k ? cru('selected') : ''}>${v}</option>`)}</select></label>
        <label>Selo<select name="selo">${Object.entries(SELOS).map(([k, v]) => html`<option value="${k}" ${(p.selo || '') === k ? cru('selected') : ''}>${v}</option>`)}</select></label>
      </div>
      <label>Resumo (aparece logo abaixo do nome)<textarea name="resumo" rows="2" maxlength="280">${p.resumo || ''}</textarea></label>
      <label>Descrição<textarea name="descricao" rows="7" maxlength="6000">${p.descricao || ''}</textarea><small>Deixe uma linha em branco entre parágrafos.</small></label>
      <label>Como usar / indicação<textarea name="modo_uso" rows="4" maxlength="3000">${p.modo_uso || ''}</textarea></label>
      <label>Endereço da página<span class="prefixo"><span>/produto/</span><input name="slug" value="${p.slug || ''}" maxlength="80" pattern="[a-z0-9\-]*" data-slug></span><small>Preenchido sozinho a partir do nome.</small></label>
    </section>
    <div>
      <section class="caixa">
        <h2>Publicação</h2>
        <label class="check"><input type="checkbox" name="ativo" value="1" ${p.ativo === undefined || p.ativo ? cru('checked') : ''}> Mostrar no site</label>
        <label class="check"><input type="checkbox" name="destaque" value="1" ${p.destaque ? cru('checked') : ''}> Destaque na página inicial</label>
        <label>Ordem (menor aparece antes)<input type="number" name="ordem" value="${p.ordem || 0}" min="0" max="9999"></label>
      </section>
      <section class="caixa">
        <h2>Fotos</h2>
        ${p.imagens && p.imagens.length ? html`<ul class="fotos">${p.imagens.map((im, i) => html`<li>
          <img src="${urlImagem(im.arquivo, 480)}" alt="" width="120" height="120">
          <label>Texto alternativo<input name="img_alt_${im.id}" value="${im.alt}" maxlength="140"></label>
          <label>Posição<input type="number" name="img_ordem_${im.id}" value="${i + 1}" min="1" max="99"></label>
          <label class="check perigo"><input type="checkbox" name="remover_img[]" value="${im.id}"> Remover</label>
        </li>`)}</ul><p class="dica">A foto na posição 1 é a capa.</p>` : ''}
        <label class="soltar" data-soltar>Adicionar fotos<input type="file" name="imagens" accept="image/jpeg,image/png,image/webp,image/avif" multiple data-preview><span>Arraste aqui ou clique. JPG, PNG ou WebP, até 8 MB cada.</span></label>
        <div class="preview" data-preview-alvo></div>
      </section>
    </div>
  </div>
  <section class="caixa">
    <h2>Opções e preços</h2>
    <p class="dica">Uma linha para cada tamanho ou sabor (ex.: 1 kg, 3 kg, 15 kg). Preço promocional é opcional.</p>
    <div class="linhas" data-linhas="var">
      <div class="linha-cab"><span>Opção</span><span>Preço (R$)</span><span>Promo (R$)</span><span>Código</span><span>Estoque</span><span></span></div>
      ${vars.map((v) => linhaVar(v, preco))}
    </div>
    <button type="button" class="btn btn-sec btn-peq" data-add-linha="var">+ Adicionar opção</button>
    <template data-modelo="var">${linhaVar({ rotulo: '', preco: '', preco_promo: '', sku: '', estoque: 'disponivel' }, preco)}</template>
  </section>
  <section class="caixa">
    <h2>Ficha técnica</h2>
    <p class="dica">Ex.: Idade · Adultos; Porte · Médio e grande; Sabor · Frango e arroz.</p>
    <div class="linhas" data-linhas="info">
      ${info.map((i) => linhaInfo(i))}
    </div>
    <button type="button" class="btn btn-sec btn-peq" data-add-linha="info">+ Adicionar informação</button>
    <template data-modelo="info">${linhaInfo({ chave: '', valor: '' })}</template>
  </section>
  <div class="acoes-form">
    <button class="btn" type="submit">${novo ? 'Criar produto' : 'Salvar alterações'}</button>
    <a class="btn btn-sec" href="/admin/produtos">Cancelar</a>
  </div>
</form>
${!novo ? html`<form class="excluir" method="post" action="/admin/produtos/${p.id}/excluir" data-confirma="Excluir “${p.nome}” de vez? Isso não pode ser desfeito.">${csrf(admin)}<button class="btn btn-perigo" type="submit">Excluir produto</button></form>` : ''}`,
  });
}

function linhaVar(v, preco) {
  return html`<div class="linha linha-var">
    <input name="var_rotulo[]" value="${v.rotulo || ''}" maxlength="40" placeholder="Ex.: 15 kg" aria-label="Opção">
    <input name="var_preco[]" value="${preco(v.preco)}" inputmode="decimal" placeholder="0,00" aria-label="Preço">
    <input name="var_promo[]" value="${preco(v.preco_promo)}" inputmode="decimal" placeholder="—" aria-label="Preço promocional">
    <input name="var_sku[]" value="${v.sku || ''}" maxlength="40" placeholder="opcional" aria-label="Código">
    <select name="var_estoque[]" aria-label="Estoque">${Object.entries(ESTOQUE).map(([k, t]) => html`<option value="${k}" ${v.estoque === k ? cru('selected') : ''}>${t}</option>`)}</select>
    <button type="button" class="tira" data-tira-linha aria-label="Remover opção">×</button>
  </div>`;
}

function linhaInfo(i) {
  return html`<div class="linha linha-info">
    <input name="info_chave[]" value="${i.chave || ''}" maxlength="40" placeholder="Ex.: Idade" aria-label="Informação">
    <input name="info_valor[]" value="${i.valor || ''}" maxlength="200" placeholder="Ex.: Adultos" aria-label="Valor">
    <button type="button" class="tira" data-tira-linha aria-label="Remover informação">×</button>
  </div>`;
}

function listaCategorias({ admin, cats, aviso, erro }) {
  return base({
    titulo: 'Categorias', admin, atual: 'categorias', aviso, erro, corpo: html`
<header class="cab"><h1>Categorias</h1><a class="btn" href="/admin/categorias/nova">+ Nova categoria</a></header>
<div class="cards-cat">${cats.map((c) => html`<a class="card-cat cor-${c.cor}" href="/admin/categorias/${c.id}">
  <b>${c.nome}</b><span>${c.total} produtos${c.ativo ? '' : ' · escondida'}</span></a>`)}</div>`,
  });
}

function formCategoria({ admin, c, erro }) {
  const nova = !c.id;
  return base({
    titulo: nova ? 'Nova categoria' : c.nome, admin, atual: 'categorias', erro, corpo: html`
<header class="cab"><h1>${nova ? 'Nova categoria' : 'Editar categoria'}</h1></header>
<form class="form caixa estreito" method="post" enctype="multipart/form-data" action="${nova ? '/admin/categorias/nova' : `/admin/categorias/${c.id}`}" data-protege>
  ${csrf(admin)}
  <label>Nome *<input name="nome" value="${c.nome || ''}" required maxlength="60" data-gera-slug></label>
  <label>Endereço<span class="prefixo"><span>/categoria/</span><input name="slug" value="${c.slug || ''}" maxlength="80" pattern="[a-z0-9\-]*" data-slug></span></label>
  <label>Descrição curta<textarea name="descricao" rows="3" maxlength="300">${c.descricao || ''}</textarea></label>
  <div class="lado">
    <label>Cor do cartão<select name="cor">${Object.entries(CORES).map(([k, v]) => html`<option value="${k}" ${c.cor === k ? cru('selected') : ''}>${v}</option>`)}</select></label>
    <label>Ordem<input type="number" name="ordem" value="${c.ordem || 0}" min="0" max="999"></label>
  </div>
  ${c.arte ? html`<div class="arte-atual"><img src="${urlImagem(c.arte, 480)}" alt="" width="120" height="150"><label class="check perigo"><input type="checkbox" name="remover_arte" value="1"> Voltar para a arte padrão</label></div>` : ''}
  <label class="soltar" data-soltar>Arte da categoria (PNG sem fundo fica melhor)<input type="file" name="arte" accept="image/png,image/webp,image/jpeg" data-preview><span>Opcional.</span></label>
  <div class="preview" data-preview-alvo></div>
  <label class="check"><input type="checkbox" name="ativo" value="1" ${c.ativo === undefined || c.ativo ? cru('checked') : ''}> Mostrar no site</label>
  <div class="acoes-form"><button class="btn" type="submit">Salvar</button><a class="btn btn-sec" href="/admin/categorias">Cancelar</a></div>
</form>
${!nova ? html`<form class="excluir" method="post" action="/admin/categorias/${c.id}/excluir" data-confirma="Excluir a categoria “${c.nome}”? Os produtos dela ficam sem categoria.">${csrf(admin)}<button class="btn btn-perigo" type="submit">Excluir categoria</button></form>` : ''}`,
  });
}

const CAMPOS_LOJA = [
  ['Identidade', [['loja_nome', 'Nome da loja'], ['assinatura', 'Assinatura']]],
  ['Contato', [['whatsapp', 'WhatsApp (com DDD, só números)', 'Ex.: 31999998888. É para ele que os pedidos vão.'], ['telefone', 'Telefone para exibir'], ['email', 'E-mail'], ['instagram', 'Instagram (ex.: @planetaanimal)']]],
  ['Endereço e horário', [['endereco', 'Endereço', '', 2], ['cidade', 'Cidade / UF'], ['mapa_link', 'Link do Google Maps'], ['horario', 'Horário de funcionamento', '', 3]]],
  ['Textos do site', [['aviso_topo', 'Faixa de aviso no topo', 'Deixe vazio para esconder.'], ['hero_titulo', 'Título principal da home', 'A última palavra fica gigante.'], ['hero_texto', 'Texto da home', '', 3], ['sobre_texto', 'Sobre a loja', '', 5], ['entrega_texto', 'Entrega', '', 3], ['pagamento_texto', 'Pagamento', '', 2]]],
];

function formLoja({ admin, cfg, aviso, erro }) {
  return base({
    titulo: 'Dados da loja', admin, atual: 'loja', aviso, erro, corpo: html`
<header class="cab"><h1>Dados da loja</h1></header>
<form class="form" method="post" action="/admin/loja" data-protege>
  ${csrf(admin)}
  ${CAMPOS_LOJA.map(([grupo, campos]) => html`<section class="caixa"><h2>${grupo}</h2>${campos.map(([k, rotulo, dica, linhas]) => html`<label>${rotulo}${linhas
    ? html`<textarea name="${k}" rows="${linhas}" maxlength="2000">${cfg[k] || ''}</textarea>`
    : html`<input name="${k}" value="${cfg[k] || ''}" maxlength="300">`}${dica ? html`<small>${dica}</small>` : ''}</label>`)}</section>`)}
  <div class="acoes-form"><button class="btn" type="submit">Salvar</button></div>
</form>`,
  });
}

function usuarios({ admin, lista, aviso, erro }) {
  return base({
    titulo: 'Usuários', admin, atual: 'usuarios', aviso, erro, corpo: html`
<header class="cab"><h1>Quem acessa o painel</h1></header>
<div class="duas">
  <section class="caixa">
    <ul class="lista-simples">${lista.map((u) => html`<li><b>${u.nome || u.email}</b> <em>${u.email}</em><small>Último acesso: ${u.ultimo_login || 'nunca'}</small>
      ${u.id !== admin.id ? html`<form method="post" action="/admin/usuarios/${u.id}/excluir" data-confirma="Remover o acesso de ${u.email}?">${csrf(admin)}<button class="btn btn-perigo btn-peq" type="submit">Remover</button></form>` : html`<small>(você)</small>`}</li>`)}</ul>
  </section>
  <form class="caixa form" method="post" action="/admin/usuarios">
    ${csrf(admin)}
    <h2>Novo acesso</h2>
    <label>Nome<input name="nome" maxlength="60"></label>
    <label>E-mail *<input type="email" name="email" required maxlength="120" autocomplete="off"></label>
    <label>Senha provisória *<input type="password" name="senha" required minlength="10" maxlength="200" autocomplete="new-password"><small>Mínimo 10 caracteres, com letras e números.</small></label>
    <button class="btn" type="submit">Criar acesso</button>
  </form>
</div>`,
  });
}

function conta({ admin, aviso, erro }) {
  return base({
    titulo: 'Minha senha', admin, aviso, erro, corpo: html`
<header class="cab"><h1>Trocar minha senha</h1></header>
<form class="form caixa estreito" method="post" action="/admin/conta">
  ${csrf(admin)}
  <label>Senha atual<input type="password" name="atual" required autocomplete="current-password" maxlength="200"></label>
  <label>Nova senha<input type="password" name="nova" required minlength="10" autocomplete="new-password" maxlength="200"><small>Mínimo 10 caracteres, com letras e números.</small></label>
  <label>Repita a nova senha<input type="password" name="nova2" required minlength="10" autocomplete="new-password" maxlength="200"></label>
  <button class="btn" type="submit">Trocar senha</button>
</form>`,
  });
}

function atividade({ admin, lista }) {
  return base({
    titulo: 'Atividade', admin, atual: 'atividade', corpo: html`
<header class="cab"><h1>Atividade recente</h1></header>
<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Quando (UTC)</th><th>Quem</th><th>O quê</th><th>Item</th><th>IP</th></tr></thead>
<tbody>${lista.map((a) => html`<tr><td>${a.em}</td><td>${a.email || '—'}</td><td>${a.acao}</td><td>${a.alvo}</td><td>${a.ip}</td></tr>`)}</tbody></table></div>`,
  });
}

module.exports = { base, entrar, painel, listaProdutos, formProduto, listaCategorias, formCategoria, formLoja, usuarios, conta, atividade };
