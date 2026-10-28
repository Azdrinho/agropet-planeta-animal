/* A fonte Relaxe não desenha acentos: compõe til, agudo, circunflexo, crase e cedilha por cima das letras.
   Usado no painel (o site público tem a mesma rotina dentro do site.js). */
(() => {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MAPA = { 'Ã': 'a til', 'Õ': 'o til', 'Ñ': 'n til', 'Â': 'a circ', 'Ê': 'e circ', 'Ô': 'o circ', 'Á': 'a agudo', 'É': 'e agudo', 'Í': 'i agudo', 'Ó': 'o agudo', 'Ú': 'u agudo', 'À': 'a grave', 'Ç': 'c ced' };
  const TRACO = { til: 'M8 70C22 20 42 24 52 46C62 68 80 72 92 26', circ: 'M14 84L50 22L86 84', agudo: 'M36 88L70 14', grave: 'M30 14L64 88', ced: 'M48 0V22C78 26 84 56 66 76C54 90 32 92 18 82' };
  // Métricas da Relaxe: ascendente .805, descendente .2, maiúscula .693 (fração do tamanho da fonte)
  const baseDe = (p) => {
    const cs = getComputedStyle(p);
    const lh = cs.lineHeight === 'normal' ? 1.005 : parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    return (lh - 1.005) / 2 + 0.805;
  };
  function acentuar() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nos = [];
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (p && /[À-ÿ]/.test(n.nodeValue) && !p.closest('input,textarea,select,option,.ac') && /Relaxe/.test(getComputedStyle(p).fontFamily)) nos.push(n);
    }
    for (const t of nos) {
      const f = document.createDocumentFragment();
      const linhaBase = baseDe(t.parentElement);
      for (const palavra of t.nodeValue.split(/(\s+)/)) {
        if (!/[À-ÿ]/.test(palavra)) { f.append(palavra); continue; }
        const pal = document.createElement('span');
        pal.className = 'pal';
        for (const ch of palavra) {
          const k = MAPA[ch.toUpperCase()];
          if (!k) { pal.append(ch); continue; }
          const [base, sinal] = k.split(' ');
          const s = document.createElement('span');
          s.className = 'ac';
          s.textContent = base;
          const svg = document.createElementNS(NS, 'svg');
          svg.setAttribute('class', `mk mk-${sinal}`);
          svg.setAttribute('viewBox', '0 0 100 100');
          svg.setAttribute('preserveAspectRatio', 'none');
          svg.setAttribute('aria-hidden', 'true');
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', TRACO[sinal]);
          svg.append(path);
          svg.style.top = (sinal === 'ced' ? linhaBase - 0.015 : linhaBase - 0.913) + 'em';
          svg.style.bottom = 'auto';
          s.append(svg);
          pal.append(s);
        }
        f.append(pal);
      }
      t.replaceWith(f);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', acentuar); else acentuar();
})();
