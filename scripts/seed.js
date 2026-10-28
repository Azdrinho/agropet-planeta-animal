// Dados de exemplo: categorias e alguns produtos com embalagens reais (preços ilustrativos).
// Só roda se o catálogo estiver vazio.  npm run seed
const fs = require('node:fs');
const path = require('node:path');
const { db } = require('../src/db');
const { salvarImagem } = require('../src/imagens');

const CATS = [
  ['racoes', 'Rações', 'Ração seca e úmida pra cães e gatos de todas as idades.', 'verde'],
  ['petiscos', 'Petiscos', 'Agrado, recompensa e cuidado com os dentes.', 'terra'],
  ['brinquedos', 'Brinquedos', 'Pra deixar a casa de cabeça pra baixo.', 'sol'],
  ['acessorios', 'Acessórios', 'Guias, coleiras, comedouros e caminhas.', 'azul'],
  ['higiene-e-saude', 'Higiene e saúde', 'Banho, tapete, areia e cuidados do dia a dia.', 'azul'],
  ['roca-e-criacao', 'Roça e criação', 'Ração e cuidado pra galinha, pássaro e bicho de criação.', 'creme'],
];

const PRODS = [
  { slug: 'golden-formula-caes-adultos-frango-e-arroz', nome: 'Golden Fórmula Cães Adultos Frango e Arroz', marca: 'PremieR Pet', cat: 'racoes', especie: 'caes', destaque: 1,
    resumo: 'Ração premium especial para cães adultos, sabor frango e arroz.', fotos: ['golden-formula-caes.png', 'golden-formula-caes-verso.png'],
    variantes: [['3 kg', 6990, 5990], ['15 kg', 18990, null]], info: [['Idade', 'Adultos'], ['Porte', 'Médio e grande'], ['Sabor', 'Frango e arroz']] },
  { slug: 'golden-gatos-castrados-salmao', nome: 'Golden Gatos Castrados Salmão', marca: 'PremieR Pet', cat: 'racoes', especie: 'gatos', destaque: 1,
    resumo: 'Para gatos castrados, com calorias controladas. Sabor salmão.', fotos: ['golden-gatos-castrados.png'],
    variantes: [['1 kg', 3490, null], ['10,1 kg', 18990, 16990]], info: [['Idade', 'Adultos'], ['Indicação', 'Gatos castrados'], ['Sabor', 'Salmão']] },
  { slug: 'pedigree-dentastix-racas-medias', nome: 'Pedigree Dentastix Raças Médias', marca: 'Pedigree', cat: 'petiscos', especie: 'caes', destaque: 1,
    resumo: 'Petisco de cuidado oral. Um por dia.', fotos: ['pedigree-dentastix.png'],
    variantes: [['3 unidades', 1490, 1290], ['7 unidades', 2990, null]], info: [['Peso do cão', '10 a 25 kg'], ['Uso', '1 unidade por dia']] },
  { slug: 'dreamies-mix-carne-e-frango', nome: 'Dreamies Mix Carne e Frango', marca: 'Dreamies', cat: 'petiscos', especie: 'gatos', destaque: 1,
    resumo: 'Petisco crocante por fora e cremoso por dentro.', fotos: ['dreamies-mix.png', 'dreamies-mix-verso.png'],
    variantes: [['80 g', 1290, null]], info: [['Idade', 'Adultos'], ['Sabor', 'Carne e frango']] },
  { slug: 'guia-retratil-flexi-new-classic-3m', nome: 'Guia Retrátil Flexi New Classic 3 m', marca: 'Flexi', cat: 'acessorios', especie: 'caes', destaque: 0,
    resumo: 'Guia retrátil com freio, para cães pequenos.', fotos: ['flexi-new-classic.png'],
    variantes: [['3 m · vermelha', 13490, 12990]], info: [['Comprimento', '3 m'], ['Indicação', 'Cães pequenos']] },
];

(async () => {
  if (db.prepare('SELECT COUNT(*) n FROM categories').get().n) { console.log('Catálogo já tem dados; nada feito.'); return; }
  const ids = {};
  CATS.forEach(([slug, nome, desc, cor], i) => {
    ids[slug] = Number(db.prepare('INSERT INTO categories (slug, nome, descricao, cor, ordem) VALUES (?, ?, ?, ?, ?)').run(slug, nome, desc, cor, i).lastInsertRowid);
  });
  for (const [i, p] of PRODS.entries()) {
    const id = Number(db.prepare(`INSERT INTO products (slug, nome, marca, categoria_id, especie, resumo, destaque, ordem)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(p.slug, p.nome, p.marca, ids[p.cat], p.especie, p.resumo, p.destaque, i).lastInsertRowid);
    p.variantes.forEach(([rot, preco, promo], j) => db.prepare('INSERT INTO variants (product_id, rotulo, preco, preco_promo, ordem) VALUES (?, ?, ?, ?, ?)').run(id, rot, preco, promo, j));
    p.info.forEach(([k, v], j) => db.prepare('INSERT INTO product_info (product_id, chave, valor, ordem) VALUES (?, ?, ?, ?)').run(id, k, v, j));
    for (const [j, f] of p.fotos.entries()) {
      const base = await salvarImagem(fs.readFileSync(path.join(__dirname, 'exemplo', f)), 'produtos');
      db.prepare('INSERT INTO product_images (product_id, arquivo, alt, ordem) VALUES (?, ?, ?, ?)').run(id, base, p.nome, j + 1);
    }
  }
  console.log(`Exemplo criado: ${CATS.length} categorias, ${PRODS.length} produtos.`);
})();
