// Converte as artes da pasta ../marca (cenas, recortes, logos, mascotes, posts) para a web.
// Rode: npm run artes   (só precisa rodar de novo se trocar alguma arte)
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');

const MARCA = path.join(__dirname, '..', '..', 'marca');
const CENAS = path.join(MARCA, 'fotos', 'cenas');
const ARTES = path.join(__dirname, '..', 'public', 'img', 'artes');
const MARCA_WEB = path.join(__dirname, '..', 'public', 'img', 'marca');
const POSTS_WEB = path.join(__dirname, '..', 'public', 'img', 'posts');
for (const p of [ARTES, MARCA_WEB, POSTS_WEB]) fs.mkdirSync(p, { recursive: true });

// Recortes (pet sem fundo): corta a transparência e limita a altura.
// Regra: só recortes INTEIROS (nada encostando na borda da foto original) e embalagens sempre com marca.
const RECORTES = {
  'hero-cao': ['r-hero-inteiro-pet', 1500, { esmaecer: 0.16 }], // corpo inteiro, some suave embaixo
  'cat-racoes': ['k-golden-pet', 900],
  'cat-petiscos': ['s-dentastix-cao-pet', 900],
  'cat-brinquedos': ['t-brinquedo-sol-pet', 900],
  'cat-acessorios': ['j-passeio-pet', 900],
  'cat-higiene': ['p-banho-pet', 900],
  'cat-roca': ['q-galinha-pet', 900],
  'esp-caes': ['c-papel-pet', 900],
  'esp-gatos': ['m-dreamies-pet', 900],
  'flagra': ['u-flagra-golden-pet', 1000],
};
// cenas inteiras (fundo de seção)
const CENAS_WEB = {
  'cena-colo': ['f-colo', 1400],
  'cena-galinha': ['q-galinha', 1200],
};

// Máscara que faz a parte de baixo do recorte sumir aos poucos
function mascaraEsmaecer(w, h, fracao) {
  const ini = ((1 - fracao) * 100).toFixed(1);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff"/><stop offset="${ini}%" stop-color="#fff"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
}

async function main() {
  for (const f of fs.readdirSync(ARTES)) {
    const nome = f.replace(/\.(webp|jpg)$/, '');
    if (!RECORTES[nome] && !CENAS_WEB[nome] && !['og', 'sem-foto'].includes(nome)) fs.rmSync(path.join(ARTES, f)); // arte que saiu de uso
  }
  for (const [nome, [orig, alt, op = {}]] of Object.entries(RECORTES)) {
    let img = sharp(await sharp(path.join(CENAS, `${orig}.png`)).trim({ threshold: 5 })
      .resize({ height: alt, withoutEnlargement: true }).png().toBuffer());
    if (op.esmaecer) {
      const { width, height } = await img.metadata();
      img = sharp(await img.composite([{ input: mascaraEsmaecer(width, height, op.esmaecer), blend: 'dest-in' }]).png().toBuffer());
    }
    await img.webp({ quality: 84, alphaQuality: 92 }).toFile(path.join(ARTES, `${nome}.webp`));
  }
  for (const [nome, [orig, w]] of Object.entries(CENAS_WEB)) {
    await sharp(path.join(CENAS, `${orig}.png`)).resize({ width: w }).webp({ quality: 80 }).toFile(path.join(ARTES, `${nome}.webp`));
  }
  // imagem de compartilhamento (1200x630)
  await sharp(path.join(CENAS, 'a-racao.png')).resize(1200, 630, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 })
    .toFile(path.join(ARTES, 'og.jpg'));
  // "sem foto": quadrado creme com o símbolo
  const simbolo = fs.readFileSync(path.join(MARCA, 'logo', 'agropet-simbolo.svg'));
  const marcaPng = await sharp(simbolo).resize(260).png().toBuffer();
  await sharp({ create: { width: 800, height: 800, channels: 4, background: '#FBF5E8' } })
    .composite([{ input: marcaPng, gravity: 'center' }]).webp({ quality: 80 }).toFile(path.join(ARTES, 'sem-foto.webp'));
  // logos e mascotes (SVG)
  for (const f of fs.readdirSync(path.join(MARCA, 'logo')).filter((f) => f.endsWith('.svg'))) {
    fs.copyFileSync(path.join(MARCA, 'logo', f), path.join(MARCA_WEB, f));
  }
  for (const f of ['farofa-esperanca.svg', 'farofa-feliz.svg', 'pacoca-julgando.svg', 'pacoca-feliz.svg', 'selo-sol.svg']) {
    fs.copyFileSync(path.join(MARCA, 'mascotes', f), path.join(MARCA_WEB, f));
  }
  // posts para a vitrine do Instagram
  for (const f of fs.readdirSync(path.join(MARCA, 'posts')).filter((f) => f.endsWith('.png'))) {
    await sharp(path.join(MARCA, 'posts', f)).resize({ width: 540 }).webp({ quality: 80 }).toFile(path.join(POSTS_WEB, f.replace('.png', '.webp')));
  }
  console.log('artes prontas');
}

main().catch((e) => { console.error(e); process.exit(1); });
