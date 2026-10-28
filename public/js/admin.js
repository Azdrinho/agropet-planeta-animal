/* Painel: linhas dinâmicas, prévia de fotos, slug automático, confirmações e aviso de alterações não salvas. */
(() => {
  'use strict';
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // adicionar / remover linhas (opções e ficha técnica)
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-linha]');
    if (add) {
      const tipo = add.dataset.addLinha;
      const modelo = document.querySelector(`template[data-modelo="${tipo}"]`);
      const alvo = document.querySelector(`[data-linhas="${tipo}"]`);
      const nova = modelo.content.firstElementChild.cloneNode(true);
      alvo.append(nova);
      const primeiro = nova.querySelector('input');
      if (primeiro) primeiro.focus();
      return;
    }
    const tira = e.target.closest('[data-tira-linha]');
    if (tira) {
      const linha = tira.closest('.linha');
      const irmas = $$('.linha', linha.parentElement);
      if (irmas.length > 1) linha.remove();
      else $$('input', linha).forEach((i) => { i.value = ''; });
      sujo = true;
    }
  });

  // slug automático a partir do nome (até a pessoa mexer no slug)
  const nome = document.querySelector('[data-gera-slug]');
  const slug = document.querySelector('[data-slug]');
  if (nome && slug) {
    let manual = slug.value !== '';
    slug.addEventListener('input', () => { manual = slug.value !== ''; });
    nome.addEventListener('input', () => {
      if (manual) return;
      slug.value = nome.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    });
  }

  // prévia das fotos escolhidas + arrastar e soltar
  $$('[data-preview]').forEach((inp) => {
    const alvo = inp.closest('form').querySelector('[data-preview-alvo]');
    const zona = inp.closest('[data-soltar]');
    inp.addEventListener('change', () => {
      alvo.textContent = '';
      [...inp.files].slice(0, 12).forEach((f) => {
        if (!f.type.startsWith('image/')) return;
        const img = document.createElement('img');
        img.alt = '';
        img.src = URL.createObjectURL(f);
        img.onload = () => URL.revokeObjectURL(img.src);
        alvo.append(img);
      });
      sujo = true;
    });
    if (zona) {
      ['dragenter', 'dragover'].forEach((ev) => zona.addEventListener(ev, () => zona.classList.add('sobre')));
      ['dragleave', 'drop'].forEach((ev) => zona.addEventListener(ev, () => zona.classList.remove('sobre')));
    }
  });

  // confirmação antes de excluir
  $$('[data-confirma]').forEach((f) => f.addEventListener('submit', (e) => {
    if (!confirm(f.dataset.confirma)) e.preventDefault();
  }));

  // avisa se sair com alterações não salvas
  let sujo = false;
  $$('form[data-protege]').forEach((f) => {
    f.addEventListener('input', () => { sujo = true; });
    f.addEventListener('submit', () => {
      sujo = false;
      const b = f.querySelector('button[type="submit"]');
      if (b) { b.disabled = true; b.textContent = 'Salvando…'; }
    });
  });
  addEventListener('beforeunload', (e) => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

  // chaves liga/desliga: envia e mostra o estado novo na hora
  $$('.alterna').forEach((f) => f.addEventListener('submit', () => {
    const b = f.querySelector('.chave');
    b.classList.toggle('ligada');
  }));
})();
