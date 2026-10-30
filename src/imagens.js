// Upload de imagens: tudo é decodificado e re-codificado pelo sharp (remove metadados/EXIF,
// derruba arquivos disfarçados) e salvo como WebP em 3 tamanhos, com nome aleatório.
const sharp = require('sharp');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const RAIZ = path.join(__dirname, '..', 'uploads');
const TAMANHOS = [480, 960, 1600];
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

sharp.cache(false);

// Na Vercel (com BLOB_READ_WRITE_TOKEN) as fotos vão para o Vercel Blob; no computador, para a pasta uploads/.
const NA_NUVEM = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const BLOB_OK = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/(produtos|categorias)\/[a-f0-9]{24}$/i;

async function salvarImagem(buffer, pasta) {
  const destino = path.join(RAIZ, pasta);
  if (!NA_NUVEM) fs.mkdirSync(destino, { recursive: true });
  const meta = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata(); // lança erro se não for imagem
  if (!meta.width || !meta.height) throw new Error('Imagem inválida.');
  // Fotos de produto (packshot) costumam vir com muita margem branca ou transparente:
  // corta essa sobra para a embalagem preencher o quadro do card.
  if (pasta === 'produtos') buffer = await aparar(buffer);
  const nome = crypto.randomBytes(12).toString('hex');
  let baseBlob = '';
  for (const w of TAMANHOS) {
    const webp = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: w > 1000 ? 82 : 80, alphaQuality: 90 })
      .toBuffer();
    if (NA_NUVEM) {
      const { put } = require('@vercel/blob');
      const r = await put(`${pasta}/${nome}-${w}.webp`, webp, { access: 'public', addRandomSuffix: false, contentType: 'image/webp', cacheControlMaxAge: 31536000 });
      baseBlob = r.url.replace(/-\d+\.webp$/, '');
    } else {
      fs.writeFileSync(path.join(destino, `${nome}-${w}.webp`), webp);
    }
  }
  return NA_NUVEM ? baseBlob : `${pasta}/${nome}`;
}

async function aparar(buffer) {
  try {
    const { hasAlpha } = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
    const cortada = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate()
      .trim(hasAlpha ? { threshold: 10 } : { background: '#ffffff', threshold: 18 })
      .toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = cortada.info;
    if (w < 40 || h < 40) return buffer; // a foto era quase toda da mesma cor: deixa como está
    // devolve com uma folga de 4% em volta, no mesmo fundo
    const folga = Math.round(Math.max(w, h) * 0.04);
    return await sharp(cortada.data).extend({
      top: folga, bottom: folga, left: folga, right: folga,
      background: hasAlpha ? { r: 0, g: 0, b: 0, alpha: 0 } : '#ffffff',
    }).toBuffer();
  } catch {
    return buffer;
  }
}

async function apagarImagem(base) {
  try {
    if (BLOB_OK.test(base)) { // só apaga arquivos gerados por nós
      const { del } = require('@vercel/blob');
      await del(TAMANHOS.map((w) => `${base}-${w}.webp`));
    } else if (/^[a-z-]+\/[a-f0-9]{24}$/.test(base)) {
      for (const w of TAMANHOS) fs.rmSync(path.join(RAIZ, `${base}-${w}.webp`), { force: true });
    }
  } catch (e) {
    console.error('Não consegui apagar a imagem', base, e.message);
  }
}

// URL pública de um tamanho. base = URL do Blob, "produtos/abc123..." (disco) ou arte fixa "/img/..."
function prefixo(base) {
  return base.startsWith('https://') ? base : `/uploads/${base}`;
}
function urlImagem(base, w = 960) {
  if (!base) return '/img/artes/sem-foto.webp';
  if (base.startsWith('/')) return base;
  return `${prefixo(base)}-${w}.webp`;
}

function srcset(base) {
  if (!base || base.startsWith('/')) return '';
  return TAMANHOS.map((w) => `${prefixo(base)}-${w}.webp ${w}w`).join(', ');
}

module.exports = { salvarImagem, apagarImagem, urlImagem, srcset, TIPOS };
