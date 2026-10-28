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

async function salvarImagem(buffer, pasta) {
  const destino = path.join(RAIZ, pasta);
  fs.mkdirSync(destino, { recursive: true });
  const meta = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata(); // lança erro se não for imagem
  if (!meta.width || !meta.height) throw new Error('Imagem inválida.');
  // Fotos de produto (packshot) costumam vir com muita margem branca ou transparente:
  // corta essa sobra para a embalagem preencher o quadro do card.
  if (pasta === 'produtos') buffer = await aparar(buffer);
  const nome = crypto.randomBytes(12).toString('hex');
  for (const w of TAMANHOS) {
    await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: w > 1000 ? 82 : 80, alphaQuality: 90 })
      .toFile(path.join(destino, `${nome}-${w}.webp`));
  }
  return `${pasta}/${nome}`;
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

function apagarImagem(base) {
  if (!/^[a-z-]+\/[a-f0-9]{24}$/.test(base)) return; // só apaga arquivos gerados por nós
  for (const w of TAMANHOS) fs.rm(path.join(RAIZ, `${base}-${w}.webp`), { force: true }, () => {});
}

// URL pública de um tamanho. base = "produtos/abc123..." (upload) ou caminho de arte fixa "/img/..."
function urlImagem(base, w = 960) {
  if (!base) return '/img/artes/sem-foto.webp';
  if (base.startsWith('/')) return base;
  return `/uploads/${base}-${w}.webp`;
}

function srcset(base) {
  if (!base || base.startsWith('/')) return '';
  return TAMANHOS.map((w) => `/uploads/${base}-${w}.webp ${w}w`).join(', ');
}

module.exports = { salvarImagem, apagarImagem, urlImagem, srcset, TIPOS };
