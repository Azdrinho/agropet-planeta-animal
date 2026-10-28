/* Planeta Animal Agropet — interações do site.
   Regras: nada de innerHTML com dados (só textContent), tudo funciona sem animação
   quando o sistema pede menos movimento. */
(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toque = matchMedia('(hover: none)').matches;
  const reais = (c) => (Number(c) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const el = (tag, props = {}, ...filhos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    filhos.flat().forEach((f) => f && e.append(f));
    return e;
  };

  /* ---------- Relaxe: a fonte não tem acentos; desenhamos o sinal por cima da letra ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const MAPA = { 'Ã': 'a til', 'Õ': 'o til', 'Ñ': 'n til', 'Â': 'a circ', 'Ê': 'e circ', 'Ô': 'o circ', 'Á': 'a agudo', 'É': 'e agudo', 'Í': 'i agudo', 'Ó': 'o agudo', 'Ú': 'u agudo', 'À': 'a grave', 'Ç': 'c ced' };
  const TRACO = { til: 'M8 70C22 20 42 24 52 46C62 68 80 72 92 26', circ: 'M14 84L50 22L86 84', agudo: 'M36 88L70 14', grave: 'M30 14L64 88', ced: 'M48 0V22C78 26 84 56 66 76C54 90 32 92 18 82' };
  // Métricas da Relaxe (em fração do tamanho da fonte): ascendente .805, descendente .2, altura de maiúscula .693.
  // A linha de base dentro de cada letra muda com a altura de linha do título, então o sinal é posicionado por conta.
  const baseDe = (p) => {
    const cs = getComputedStyle(p);
    const lh = cs.lineHeight === 'normal' ? 1.005 : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    return (lh - 1.005) / 2 + 0.805;
  };
  const posicionar = (svg, sinal, base) => {
    svg.style.top = (sinal === 'ced' ? base - 0.015 : base - 0.693 - 0.22) + 'em';
    svg.style.bottom = 'auto';
  };
  const relaxe = new WeakMap();
  const ehRelaxe = (p) => {
    if (!relaxe.has(p)) relaxe.set(p, /Relaxe/.test(getComputedStyle(p).fontFamily));
    return relaxe.get(p);
  };
  function acentuar(raiz = document.body) {
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const nos = [];
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || p.closest('script,style,textarea,input,select,option,.ac') || !/[À-ÿ]/.test(n.nodeValue)) continue;
      if (ehRelaxe(p)) nos.push(n);
    }
    for (const t of nos) {
      const f = document.createDocumentFragment();
      const linhaBase = baseDe(t.parentElement);
      // cada palavra com acento vira um bloco que não quebra (senão "Paçoca" quebra em "Paç/oca")
      for (const palavra of t.nodeValue.split(/(\s+)/)) {
        if (!/[À-ÿ]/.test(palavra)) { f.append(palavra); continue; }
        const pal = el('span', { class: 'pal' });
        for (const ch of palavra) {
          const k = MAPA[ch.toUpperCase()];
          if (!k) { pal.append(ch); continue; }
          const [base, sinal] = k.split(' ');
          const s = el('span', { class: 'ac', text: base });
          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('class', `mk mk-${sinal}`);
          svg.setAttribute('viewBox', '0 0 100 100');
          svg.setAttribute('preserveAspectRatio', 'none');
          svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', TRACO[sinal]);
          svg.append(path);
          posicionar(svg, sinal, linhaBase);
          s.append(svg);
          pal.append(s);
        }
        f.append(pal);
      }
      // leitores de tela continuam lendo a palavra certa
      const p = t.parentElement;
      if (p && !p.hasAttribute('aria-label') && p.childNodes.length === 1) p.setAttribute('aria-label', t.nodeValue.trim());
      t.replaceWith(f);
    }
  }
  const pronto = (document.fonts && document.fonts.ready) || Promise.resolve();
  acentuar();
  new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((no) => no.nodeType === 1 && acentuar(no))))
    .observe(document.body, { childList: true, subtree: true });

  /* ---------- aparecer ao rolar ---------- */
  $$('[data-i]').forEach((e) => e.style.setProperty('--i', e.dataset.i));
  const io = 'IntersectionObserver' in window && !calmo ? new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visivel'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 }) : null;
  const observar = (raiz = document) => $$('[data-revela]', raiz).forEach((e) => (io ? io.observe(e) : e.classList.add('visivel')));
  observar();

  /* ---------- topo, menus ---------- */
  const topo = $('[data-topo]');
  addEventListener('scroll', () => {
    if (topo) topo.classList.toggle('rolou', scrollY > 40);
  }, { passive: true });

  const cats = $('.topo-cats');
  if (cats) {
    const btn = $('.topo-cats-btn', cats);
    const abrir = (v) => { cats.classList.toggle('aberto', v); btn.setAttribute('aria-expanded', String(v)); };
    btn.addEventListener('click', () => abrir(!cats.classList.contains('aberto')));
    if (!toque) {
      let t;
      cats.addEventListener('mouseenter', () => { clearTimeout(t); abrir(true); });
      cats.addEventListener('mouseleave', () => { t = setTimeout(() => abrir(false), 180); });
    }
    document.addEventListener('click', (e) => { if (!cats.contains(e.target)) abrir(false); });
  }
  const menu = $('[data-menu]');
  const btnMenu = $('[data-abre-menu]');
  btnMenu && btnMenu.addEventListener('click', () => {
    const abre = menu.hidden;
    if (abre && topo) menu.style.top = Math.max(0, topo.getBoundingClientRect().bottom) + 'px';
    menu.hidden = !abre;
    btnMenu.setAttribute('aria-label', abre ? 'Fechar menu' : 'Abrir menu');
    btnMenu.setAttribute('aria-expanded', String(abre));
    document.body.style.overflow = abre ? 'hidden' : '';
  });

  /* ---------- hero: letras, ração flutuando e parallax ---------- */
  $$('.letras').forEach((l) => $$(':scope > span', l).forEach((s, i) => s.style.setProperty('--i', i)));
  $$('.racao').forEach((r) => {
    r.style.left = r.dataset.x + '%';
    r.style.top = r.dataset.y + '%';
    r.style.rotate = r.dataset.r + 'deg';
    r.style.scale = r.dataset.s;
  });
  const hero = $('[data-hero]');
  if (hero && !calmo && !toque) {
    const camadas = $$('[data-camada], .racao', hero);
    let alvo = { x: 0, y: 0 };
    let atual = { x: 0, y: 0 };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      alvo = { x: (e.clientX - r.left) / r.width - .5, y: (e.clientY - r.top) / r.height - .5 };
    });
    hero.addEventListener('pointerleave', () => { alvo = { x: 0, y: 0 }; });
    const passo = () => {
      atual.x += (alvo.x - atual.x) * .08;
      atual.y += (alvo.y - atual.y) * .08;
      const rol = Math.min(scrollY, 900);
      for (const c of camadas) {
        const prof = Number(c.dataset.camada || c.dataset.prof || 1);
        const dir = c.classList.contains('racao') ? 2.2 : 1;
        c.style.translate = `${-atual.x * prof * 14 * dir}px ${-atual.y * prof * 10 * dir + rol * (prof === 3 ? -.06 : prof * .08)}px`;
      }
      requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  /* ---------- inclinação 3D e botões "magnéticos" ---------- */
  if (!calmo && !toque) {
    $$('[data-tilt]').forEach((c) => {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        c.style.transform = `perspective(900px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg) translateY(-6px)`;
      });
      c.addEventListener('pointerleave', () => { c.style.transform = ''; });
    });
    $$('[data-magnetico]').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.translate = `${(e.clientX - r.left - r.width / 2) * .18}px ${(e.clientY - r.top - r.height / 2) * .25}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }

  /* ---------- arrastar para rolar (trilhos horizontais) ---------- */
  $$('[data-arrasta]').forEach((t) => {
    let ini = null;
    let moveu = false;
    t.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; ini = { x: e.clientX, s: t.scrollLeft }; moveu = false; });
    addEventListener('pointermove', (e) => {
      if (!ini) return;
      const dx = e.clientX - ini.x;
      if (Math.abs(dx) > 5) { moveu = true; t.classList.add('arrastando'); }
      t.scrollLeft = ini.s - dx;
    });
    addEventListener('pointerup', () => { ini = null; t.classList.remove('arrastando'); });
    t.addEventListener('click', (e) => { if (moveu) { e.preventDefault(); e.stopPropagation(); moveu = false; } }, true);
  });

  /* ---------- mascotes falam ---------- */
  const FALAS = {
    farofa: ['Falou ração?', 'Ouvi o saco abrindo!', 'Petisco é carinho.', 'Bora passear?', 'Do campo ao colo!', 'Só mais um petisco…'],
    pacoca: ['Hmm. Avaliando.', 'Aprovado. Por hoje.', 'Cadê meu sachê?', 'Quem manda aqui sou eu.', 'Não vi nada.', 'Pode trazer o Golden.'],
  };
  $$('[data-mascote]').forEach((m) => {
    let i = 0;
    m.addEventListener('click', () => {
      const lista = FALAS[m.dataset.mascote];
      i = (i + 1) % lista.length;
      const b = $('[data-balao]', m);
      b.textContent = lista[i];
      acentuar(b);
      m.classList.remove('fala');
      void m.offsetWidth;
      m.classList.add('fala');
      if (!calmo) explodir(m.getBoundingClientRect(), 8);
    });
  });

  /* ---------- toast ---------- */
  const toastEl = $('[data-toast]');
  let toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('ver');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('ver'), 2600);
  }

  /* ---------- explosão de ração (partículas) ---------- */
  const FORMAS = [
    'M-13-5h26v10h-26z M-13-5m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
    'M0-12a12 12 0 1 1 0 24a12 12 0 1 1 0-24z',
    'M0-10L9 7H-9Z',
  ];
  function particula(x, y) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'particula');
    s.setAttribute('viewBox', '-16 -16 32 32');
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', FORMAS[Math.floor(Math.random() * FORMAS.length)]);
    s.append(p);
    s.style.left = x - 8 + 'px';
    s.style.top = y - 8 + 'px';
    document.body.append(s);
    return s;
  }
  function explodir(r, n = 12) {
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const s = particula(cx, cy);
      const ang = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 80;
      s.animate([
        { transform: 'translate(0,0) rotate(0) scale(.6)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 40}px) rotate(${Math.random() * 540}deg) scale(1)`, opacity: 1, offset: .6 },
        { transform: `translate(${Math.cos(ang) * dist * 1.2}px, ${Math.sin(ang) * dist + 60}px) rotate(${Math.random() * 720}deg) scale(.8)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => s.remove();
    }
  }
  function voarParaSacola(origem) {
    const destino = $('[data-abre-sacola]');
    if (!destino || calmo) return;
    const a = origem.getBoundingClientRect();
    const b = destino.getBoundingClientRect();
    for (let i = 0; i < 7; i++) {
      const s = particula(a.left + a.width / 2, a.top + a.height / 2);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const meio = { x: dx * .5 + (Math.random() - .5) * 160, y: Math.min(dy, 0) - 120 - Math.random() * 80 };
      s.animate([
        { transform: 'translate(0,0) scale(.4) rotate(0)', opacity: 0 },
        { transform: `translate(${meio.x}px, ${meio.y}px) scale(1.2) rotate(200deg)`, opacity: 1, offset: .45 },
        { transform: `translate(${dx}px, ${dy}px) scale(.3) rotate(420deg)`, opacity: .2 },
      ], { duration: 750 + i * 45, delay: i * 35, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'backwards' }).onfinish = () => s.remove();
    }
    setTimeout(() => {
      destino.classList.remove('mexe');
      void destino.offsetWidth;
      destino.classList.add('mexe');
    }, 720);
  }

  /* ---------- sacola ---------- */
  const CHAVE = 'pa_sacola_v1';
  const ler = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      return Array.isArray(v) ? v.filter((i) => i && Number.isInteger(i.variante) && i.qtd > 0).slice(0, 50) : [];
    } catch { return []; }
  };
  let sacola = ler();
  const gravar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(sacola)); } catch { /* modo privado */ } atualizarContador(); };
  const qtdTotal = () => sacola.reduce((s, i) => s + i.qtd, 0);
  function atualizarContador(pula) {
    const b = $('[data-sacola-qtd]');
    if (!b) return;
    const n = qtdTotal();
    b.hidden = n === 0;
    b.textContent = n > 99 ? '99+' : String(n);
    if (pula) { b.classList.remove('pula'); void b.offsetWidth; b.classList.add('pula'); }
  }
  function adicionar(item, qtd, origem) {
    const ex = sacola.find((i) => i.variante === item.variante);
    if (ex) ex.qtd = Math.min(99, ex.qtd + qtd);
    else sacola.push({ ...item, qtd: Math.min(99, qtd) });
    gravar();
    if (origem) { explodir(origem.getBoundingClientRect(), 10); voarParaSacola(origem); }
    setTimeout(() => atualizarContador(true), calmo ? 0 : 760);
    toast(`${item.nome.length > 34 ? item.nome.slice(0, 32) + '…' : item.nome} foi pra sacola!`);
  }
  atualizarContador();

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault();
    adicionar({
      id: Number(b.dataset.id), variante: Number(b.dataset.variante), nome: b.dataset.nome, rotulo: b.dataset.rotulo || '',
      preco: Number(b.dataset.preco), img: b.dataset.img, slug: b.dataset.slug,
    }, 1, b);
  });

  const gaveta = $('[data-sacola]');
  const itensEl = $('[data-sacola-itens]');
  const vaziaEl = $('[data-sacola-vazia]');
  const formEl = $('[data-sacola-form]');
  let focoAntes = null;

  function render() {
    itensEl.textContent = '';
    const vazia = sacola.length === 0;
    vaziaEl.hidden = !vazia;
    formEl.hidden = vazia;
    let total = 0;
    for (const it of sacola) {
      total += it.preco * it.qtd;
      const qtd = el('span', { text: String(it.qtd) });
      const linha = el('div', { class: 'item' },
        el('img', { src: it.img || '/img/artes/sem-foto.webp', alt: '', width: '72', height: '72' }),
        el('div', {},
          el('a', { class: 'item-nome', href: `/produto/${encodeURIComponent(it.slug || '')}` }, it.nome, it.rotulo ? el('small', { text: it.rotulo }) : null),
          el('div', { class: 'item-preco', text: `R$ ${reais(it.preco * it.qtd)}` }),
          it.aviso ? el('div', { class: 'item-aviso', text: it.aviso }) : null),
        el('div', { class: 'item-lado' },
          el('div', { class: 'qtd' },
            el('button', { type: 'button', 'aria-label': 'Diminuir', text: '−', onclick: () => mudar(it, -1) }),
            qtd,
            el('button', { type: 'button', 'aria-label': 'Aumentar', text: '+', onclick: () => mudar(it, 1) })),
          el('button', { type: 'button', class: 'item-tira', text: 'remover', onclick: (ev) => remover(it, ev.target.closest('.item')) })));
      itensEl.append(linha);
    }
    $('[data-sacola-total]').textContent = `R$ ${reais(total)}`;
  }
  function mudar(it, d) {
    it.qtd = Math.max(1, Math.min(99, it.qtd + d));
    gravar();
    render();
  }
  function remover(it, linha) {
    const fim = () => { sacola = sacola.filter((x) => x !== it); gravar(); render(); };
    if (linha && !calmo) { linha.classList.add('sai'); setTimeout(fim, 280); } else fim();
  }
  // confere preços e disponibilidade atuais no servidor
  async function conferir() {
    if (!sacola.length) return;
    try {
      const r = await fetch(`/api/variantes?ids=${sacola.map((i) => i.variante).join(',')}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const { itens } = await r.json();
      const mapa = new Map(itens.map((v) => [v.id, v]));
      for (const it of sacola) {
        const v = mapa.get(it.variante);
        if (!v) { it.aviso = 'Indisponível no momento'; continue; }
        it.aviso = v.estoque === 'esgotado' ? 'Esgotado' : v.estoque === 'sob-consulta' ? 'Disponibilidade sob consulta' : '';
        if (v.preco !== it.preco) { it.preco = v.preco; it.aviso = it.aviso || 'Preço atualizado'; }
        it.nome = v.nome;
        it.rotulo = v.rotulo;
      }
      gravar();
      render();
    } catch { /* sem rede: segue com o que tem */ }
  }
  function abrirSacola() {
    focoAntes = document.activeElement;
    render();
    gaveta.hidden = false;
    gaveta.classList.remove('saindo');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('.sacola-painel [data-fecha-sacola]').focus(), 50);
    conferir();
  }
  function fecharSacola() {
    if (gaveta.hidden) return;
    const fim = () => { gaveta.hidden = true; document.body.style.overflow = ''; focoAntes && focoAntes.focus(); };
    if (calmo) return fim();
    gaveta.classList.add('saindo');
    setTimeout(fim, 330);
  }
  $$('[data-abre-sacola]').forEach((b) => b.addEventListener('click', abrirSacola));
  $$('[data-fecha-sacola]').forEach((b) => b.addEventListener('click', fecharSacola));

  if (formEl) {
    const endereco = $('[data-endereco]', formEl);
    formEl.addEventListener('change', (e) => {
      if (e.target.name === 'entrega') endereco.hidden = e.target.value !== 'entregar';
    });
    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const erro = $('[data-sacola-erro]', formEl);
      const d = Object.fromEntries(new FormData(formEl));
      const num = document.body.dataset.whats || '';
      const falta = !String(d.nome || '').trim() ? 'Conta pra gente o seu nome.'
        : d.entrega === 'entregar' && !String(d.endereco || '').trim() ? 'Falta o endereço de entrega.'
          : !num ? 'O WhatsApp da loja ainda não foi configurado.' : '';
      if (falta) { erro.textContent = falta; erro.hidden = false; return; }
      erro.hidden = true;
      const loja = document.body.dataset.loja || 'Planeta Animal';
      let total = 0;
      const linhas = sacola.map((i) => {
        total += i.preco * i.qtd;
        return `• ${i.qtd}x ${i.nome}${i.rotulo ? ` (${i.rotulo})` : ''} — R$ ${reais(i.preco * i.qtd)}`;
      });
      const msg = [
        `Olá, ${loja}! Quero fazer um pedido pelo site:`, '', ...linhas, '',
        `Subtotal: R$ ${reais(total)}`,
        `Nome: ${String(d.nome).trim()}`,
        d.entrega === 'entregar' ? `Entrega em: ${String(d.endereco).trim()}` : 'Vou retirar na loja',
        `Pagamento: ${d.pagamento}`,
        d.obs && String(d.obs).trim() ? `Obs.: ${String(d.obs).trim()}` : '',
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      const destino = num.length <= 11 ? '55' + num : num;
      window.open(`https://wa.me/${destino}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      toast('Pedido montado! Termine no WhatsApp.');
    });
  }

  /* ---------- página de produto ---------- */
  const prod = $('[data-produto]');
  if (prod) {
    const caixaPreco = $('[data-preco-box]', prod);
    const estoqueTxt = $('[data-estoque-txt]', prod);
    const btnAdd = $('[data-add-produto]', prod);
    const campoQtd = $('[data-qtd-campo]', prod);
    const ROT = { disponivel: 'Disponível', 'sob-consulta': 'Sob consulta', esgotado: 'Esgotado' };
    const escolhida = () => $('input[name="variante"]:checked', prod) || $('input[name="variante"][type="hidden"]', prod);
    const mostrarPreco = (inp) => {
      if (!inp) return;
      const preco = Number(inp.dataset.preco);
      const promo = inp.dataset.promo ? Number(inp.dataset.promo) : null;
      const ef = promo || preco;
      const [int, cent] = reais(ef).split(',');
      caixaPreco.textContent = '';
      if (promo) caixaPreco.append(el('s', { text: `R$ ${reais(preco)}` }));
      caixaPreco.append(el('b', {}, el('i', { text: 'R$' }), int, el('i', { text: ',' + cent })));
      if (promo) caixaPreco.append(el('span', { class: 'economia', text: `economize R$ ${reais(preco - promo)}` }));
      acentuar(caixaPreco);
      caixaPreco.classList.remove('muda');
      void caixaPreco.offsetWidth;
      caixaPreco.classList.add('muda');
      estoqueTxt.textContent = ROT[inp.dataset.estoque] || '';
      estoqueTxt.classList.toggle('esgotado', inp.dataset.estoque === 'esgotado');
    };
    prod.addEventListener('change', (e) => { if (e.target.name === 'variante') mostrarPreco(e.target); });
    const qtdOk = () => Math.max(1, Math.min(99, parseInt(campoQtd.value, 10) || 1));
    $('[data-menos]', prod).addEventListener('click', () => { campoQtd.value = Math.max(1, qtdOk() - 1); });
    $('[data-mais]', prod).addEventListener('click', () => { campoQtd.value = Math.min(99, qtdOk() + 1); });
    campoQtd.addEventListener('change', () => { campoQtd.value = qtdOk(); });
    btnAdd && btnAdd.addEventListener('click', () => {
      const v = escolhida();
      if (!v) return;
      adicionar({
        id: Number(prod.dataset.id), variante: Number(v.value), nome: prod.dataset.nome, rotulo: v.dataset.rotulo || '',
        preco: Number(v.dataset.promo || v.dataset.preco), img: prod.dataset.img, slug: prod.dataset.slug,
      }, qtdOk(), btnAdd);
    });

    // galeria: troca com fade e zoom que segue o cursor
    const principal = $('[data-galeria-img]', prod);
    $$('[data-galeria-mini]', prod).forEach((b) => b.addEventListener('click', () => {
      $$('[data-galeria-mini]', prod).forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
      principal.classList.add('troca');
      setTimeout(() => {
        principal.src = b.dataset.galeriaMini;
        if (b.dataset.srcset) principal.srcset = b.dataset.srcset; else principal.removeAttribute('srcset');
        principal.alt = b.dataset.alt;
        principal.onload = () => principal.classList.remove('troca');
      }, 180);
    }));
    const zoom = $('[data-zoom]', prod);
    if (zoom && !toque) {
      zoom.addEventListener('pointermove', (e) => {
        const r = zoom.getBoundingClientRect();
        principal.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      });
      zoom.addEventListener('pointerenter', () => zoom.classList.add('zoom'));
      zoom.addEventListener('pointerleave', () => zoom.classList.remove('zoom'));
    }
  }

  /* ---------- abas ---------- */
  $$('[data-abas]').forEach((a) => {
    const btns = $$('[role="tab"]', a);
    const ativar = (b) => {
      btns.forEach((x) => {
        const on = x === b;
        x.setAttribute('aria-selected', String(on));
        x.tabIndex = on ? 0 : -1;
        $('#' + x.getAttribute('aria-controls')).hidden = !on;
      });
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => ativar(b));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { const n = btns[(i + d + btns.length) % btns.length]; ativar(n); n.focus(); }
      });
    });
  });

  /* ---------- filtros: aplicam sozinhos ---------- */
  const filtros = $('[data-filtros]');
  if (filtros) {
    filtros.addEventListener('change', (e) => {
      if (e.target.matches('input[type="radio"], select')) filtros.requestSubmit();
    });
  }

  /* ---------- busca ao vivo ---------- */
  const busca = $('[data-busca]');
  const campo = $('[data-busca-campo]');
  const resEl = $('[data-busca-res]');
  let buscaT;
  let ctrl;
  const abrirBusca = () => { busca.hidden = false; document.body.style.overflow = 'hidden'; setTimeout(() => campo.focus(), 30); };
  const fecharBusca = () => { busca.hidden = true; document.body.style.overflow = ''; };
  $$('[data-abre-busca]').forEach((b) => b.addEventListener('click', abrirBusca));
  $$('[data-fecha-busca]').forEach((b) => b.addEventListener('click', fecharBusca));
  busca && busca.addEventListener('click', (e) => { if (e.target === busca) fecharBusca(); });
  campo && campo.addEventListener('input', () => {
    clearTimeout(buscaT);
    const q = campo.value.trim();
    if (q.length < 2) { resEl.textContent = ''; return; }
    buscaT = setTimeout(async () => {
      try {
        ctrl && ctrl.abort();
        ctrl = new AbortController();
        const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
        const { itens } = await r.json();
        resEl.textContent = '';
        if (!itens.length) { resEl.append(el('p', { text: 'Nada por aqui. Tenta outra palavra?' })); return; }
        for (const i of itens) {
          resEl.append(el('a', { href: i.url },
            el('img', { src: i.img, alt: '', width: '56', height: '56' }),
            el('span', {}, i.nome, i.marca ? el('small', { text: i.marca }) : null),
            i.preco !== null ? el('b', { text: `R$ ${reais(i.preco)}` }) : null));
        }
      } catch { /* cancelada */ }
    }, 220);
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { fecharBusca(); fecharSacola(); }
    if (e.key === '/' && !e.target.closest('input,textarea,select') && busca) { e.preventDefault(); abrirBusca(); }
  });

  pronto.then(() => acentuar());
})();
