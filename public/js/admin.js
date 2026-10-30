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

  // Reduz a foto no navegador (lado maior 2000 px, WebP) para caber no limite de envio da hospedagem (4,5 MB por envio)
  async function reduzir(arquivo) {
    if (!arquivo.type.startsWith('image/')) return arquivo;
    try {
      const bmp = await createImageBitmap(arquivo);
      const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      if (escala === 1 && arquivo.size < 900 * 1024) return arquivo;
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * escala);
      c.height = Math.round(bmp.height * escala);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.88));
      if (!blob || blob.size >= arquivo.size) return arquivo;
      return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
    } catch {
      return arquivo;
    }
  }
  const MAX_FOTOS = 6;

  // prévia das fotos escolhidas + arrastar e soltar
  $$('[data-preview]').forEach((inp) => {
    const alvo = inp.closest('form').querySelector('[data-preview-alvo]');
    const zona = inp.closest('[data-soltar]');
    let reduzindo = false;
    inp.addEventListener('change', async () => {
      if (reduzindo) return;
      alvo.textContent = '';
      let arquivos = [...inp.files];
      if (arquivos.length > MAX_FOTOS) {
        alert(`Envie até ${MAX_FOTOS} fotos por vez. Salve e depois adicione as outras.`);
        arquivos = arquivos.slice(0, MAX_FOTOS);
      }
      reduzindo = true;
      const dt = new DataTransfer();
      for (const f of await Promise.all(arquivos.map(reduzir))) dt.items.add(f);
      inp.files = dt.files;
      reduzindo = false;
      [...inp.files].forEach((f) => {
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
