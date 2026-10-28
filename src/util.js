// Utilidades usadas em todo o site. TODA saída de texto em HTML passa por h().
const ENT = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

function h(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"'`]/g, (c) => ENT[c]);
}

// Template literal que escapa automaticamente as interpolações.
// Para inserir HTML já seguro (de outro template), use cru().
class Cru { constructor(s) { this.s = s; } toString() { return this.s; } }
const cru = (s) => new Cru(s);
function html(partes, ...vals) {
  let out = partes[0];
  vals.forEach((v, i) => {
    if (v instanceof Cru) out += v.s;
    else if (Array.isArray(v)) out += v.map((x) => (x instanceof Cru ? x.s : h(x))).join('');
    else out += h(v);
    out += partes[i + 1];
  });
  return cru(out);
}

function reais(centavos) {
  const n = Number(centavos) || 0;
  return (n / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "1.234,56" | "1234.56" | "59,9" -> centavos
function paraCentavos(txt) {
  if (txt === null || txt === undefined) return null;
  let s = String(txt).trim().replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return Math.round(n * 100);
}

function slugify(txt) {
  return String(txt || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

// Texto simples com quebras de linha -> parágrafos HTML seguros
function paragrafos(txt) {
  return cru(String(txt || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${h(p).replace(/\n/g, '<br>')}</p>`).join(''));
}

function linhas(txt) {
  return cru(h(txt).replace(/\n/g, '<br>'));
}

function soDigitos(txt) {
  return String(txt || '').replace(/\D/g, '');
}

const ESPECIES = {
  caes: 'Cães',
  gatos: 'Gatos',
  aves: 'Aves e pássaros',
  roca: 'Roça e criação',
  todos: 'Todos os bichos',
};
const SELOS = { '': 'Sem selo', oferta: 'Oferta', novo: 'Novidade', 'mais-vendido': 'Mais vendido' };
const ESTOQUE = { disponivel: 'Disponível', 'sob-consulta': 'Sob consulta', esgotado: 'Esgotado' };
const CORES = { verde: 'Verde', azul: 'Azul', terra: 'Terra', creme: 'Creme', sol: 'Sol' };

// muda a cada vez que o servidor sobe: força o navegador a buscar CSS/JS novos após uma atualização
const VERSAO = Date.now().toString(36);

module.exports = { VERSAO, h, html, cru, reais, paraCentavos, slugify, paragrafos, linhas, soDigitos, ESPECIES, SELOS, ESTOQUE, CORES };
