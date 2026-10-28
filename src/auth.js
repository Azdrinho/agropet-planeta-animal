// Autenticação do painel: senha com scrypt, sessão no servidor, cookie HttpOnly e token CSRF.
const crypto = require('node:crypto');
const { db } = require('./db');

const COOKIE = 'pa_sid';
const DURACAO_H = 8;              // sessão expira em 8 horas
const MAX_TENTATIVAS = 5;         // depois disso a conta fica bloqueada...
const BLOQUEIO_MIN = 15;          // ...por 15 minutos
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  const dk = crypto.scryptSync(senha, sal, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${sal.toString('base64')}$${dk.toString('base64')}`;
}

function confereSenha(senha, guardado) {
  try {
    const [alg, N, r, p, sal, hash] = String(guardado).split('$');
    if (alg !== 'scrypt') return false;
    const esperado = Buffer.from(hash, 'base64');
    const dk = crypto.scryptSync(senha, Buffer.from(sal, 'base64'), esperado.length,
      { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
    return crypto.timingSafeEqual(dk, esperado);
  } catch {
    return false;
  }
}

// Hash falso para gastar o mesmo tempo quando o e-mail não existe (não revela quais e-mails existem)
const HASH_FALSO = hashSenha(crypto.randomBytes(12).toString('hex'));

function senhaFraca(senha) {
  if (typeof senha !== 'string' || senha.length < 10) return 'A senha precisa ter pelo menos 10 caracteres.';
  if (senha.length > 200) return 'Senha longa demais.';
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return 'Use letras e números na senha.';
  return null;
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');

function lerCookies(req) {
  const out = {};
  for (const par of String(req.headers.cookie || '').split(';')) {
    const i = par.indexOf('=');
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}

function cookieSeguro(req) {
  return process.env.COOKIE_SECURE === '1' || req.secure;
}

function login(req, res, email, senha) {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim());
  const agora = new Date();
  if (!u) {
    confereSenha(String(senha || ''), HASH_FALSO);
    return { erro: 'E-mail ou senha incorretos.' };
  }
  if (u.bloqueado_ate && new Date(u.bloqueado_ate + 'Z') > agora) {
    return { erro: `Muitas tentativas. Tente de novo em alguns minutos.` };
  }
  if (!confereSenha(String(senha || ''), u.senha_hash)) {
    const t = u.tentativas + 1;
    const bloqueio = t >= MAX_TENTATIVAS
      ? new Date(agora.getTime() + BLOQUEIO_MIN * 60000).toISOString().slice(0, 19).replace('T', ' ')
      : null;
    db.prepare('UPDATE users SET tentativas = ?, bloqueado_ate = ? WHERE id = ?').run(bloqueio ? 0 : t, bloqueio, u.id);
    registrar(null, 'login falhou', u.email, req);
    return { erro: 'E-mail ou senha incorretos.' };
  }
  db.prepare("UPDATE users SET tentativas = 0, bloqueado_ate = NULL, ultimo_login = datetime('now') WHERE id = ?").run(u.id);
  criarSessao(req, res, u.id);
  registrar(u.id, 'entrou no painel', '', req);
  return { ok: true };
}

function criarSessao(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const expira = new Date(Date.now() + DURACAO_H * 3600000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT INTO sessions (id, user_id, csrf, expira_em, ip, agente) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sha(token), userId, csrf, expira, req.ip || '', String(req.headers['user-agent'] || '').slice(0, 200));
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${DURACAO_H * 3600}${cookieSeguro(req) ? '; Secure' : ''}`);
}

function sair(req, res) {
  const token = lerCookies(req)[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(sha(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0${cookieSeguro(req) ? '; Secure' : ''}`);
}

// Carrega a sessão (se houver) em req.admin
function sessao(req, _res, next) {
  db.prepare("DELETE FROM sessions WHERE expira_em < datetime('now')").run();
  const token = lerCookies(req)[COOKIE];
  if (token) {
    const s = db.prepare(`SELECT s.csrf, u.id, u.email, u.nome FROM sessions s JOIN users u ON u.id = s.user_id
                          WHERE s.id = ? AND s.expira_em > datetime('now')`).get(sha(token));
    if (s) req.admin = { id: s.id, email: s.email, nome: s.nome, csrf: s.csrf };
  }
  next();
}

function exigeAdmin(req, res, next) {
  if (req.admin) return next();
  if (req.method === 'GET') return res.redirect('/admin/entrar');
  return res.status(401).send('Sessão expirada. Entre de novo.');
}

// CSRF: todo POST do painel precisa do token da sessão e vir da mesma origem
function confereCsrf(req, res, next) {
  const origem = req.headers.origin;
  if (origem) {
    try {
      if (new URL(origem).host !== req.headers.host) return res.status(403).send('Origem inválida.');
    } catch {
      return res.status(403).send('Origem inválida.');
    }
  }
  const enviado = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!req.admin || !enviado || typeof enviado !== 'string') return res.status(403).send('Formulário expirado. Recarregue a página.');
  const a = Buffer.from(enviado);
  const b = Buffer.from(req.admin.csrf);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).send('Formulário expirado. Recarregue a página.');
  next();
}

function registrar(userId, acao, alvo, req) {
  db.prepare('INSERT INTO activity (user_id, acao, alvo, ip) VALUES (?, ?, ?, ?)')
    .run(userId, acao, String(alvo || '').slice(0, 200), (req && req.ip) || '');
}

module.exports = { hashSenha, confereSenha, senhaFraca, login, sair, sessao, exigeAdmin, confereCsrf, registrar };
