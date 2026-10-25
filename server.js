// Site do escritório + painel de contatos.
// Sem dependências externas: usa apenas módulos nativos do Node.js 22+.
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@escritorio.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_HOURS = 12;
const STATUS = ['novo', 'em_atendimento', 'concluido', 'arquivado'];

if (!ADMIN_PASSWORD) {
  console.warn('AVISO: defina ADMIN_PASSWORD para habilitar o login do painel.');
}

// ---------- Banco de dados ----------
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
const db = new DatabaseSync(process.env.DB_PATH || path.join(ROOT, 'data', 'contatos.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS contatos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    telefone TEXT,
    assunto TEXT,
    mensagem TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'novo',
    anotacoes TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------- Configuração (identidade visual e textos) ----------
function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function themeCss(cfg) {
  const c = cfg.cores || {};
  const f = cfg.fontes || {};
  return `:root{--primaria:${c.primaria};--secundaria:${c.secundaria};--fundo:${c.fundo};--texto:${c.texto};` +
    `--acento:color-mix(in srgb,${c.secundaria} 40%,${c.primaria});--fonte-titulos:'${f.titulos}',Georgia,serif;--fonte-texto:'${f.texto}',system-ui,sans-serif;}`;
}

function fontsLink(cfg) {
  const fams = [...new Set([cfg.fontes?.titulos, cfg.fontes?.texto].filter(Boolean))]
    .map(n => 'family=' + encodeURIComponent(n).replace(/%20/g, '+'));
  return fams.length ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap">` : '';
}

function brand(cfg) {
  const texto = `<span class="logo-texto">${esc(cfg.nome)}${cfg.marca_subtitulo ? `<small>${esc(cfg.marca_subtitulo)}</small>` : ''}</span>`;
  if (cfg.logo) return `<img src="${esc(cfg.logo)}" alt="" class="logo">` + texto;
  // Sem arquivo de logo: monograma com as iniciais + nome.
  const iniciais = String(cfg.nome || '').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="monograma" aria-hidden="true">${esc(iniciais)}</span>` + texto;
}

// Substitui {{chaves}} dos templates HTML pelos dados do config.json.
function render(file) {
  const cfg = loadConfig();
  const ct = cfg.contato || {};
  const zap = `https://wa.me/${String(ct.whatsapp || '').replace(/\D/g, '')}` +
    (ct.whatsapp_mensagem ? `?text=${encodeURIComponent(ct.whatsapp_mensagem)}` : '');
  const cards = (lista, cls) => (lista || []).map(s =>
    `<article class="${cls}"><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p></article>`).join('');
  const etapas = (cfg.etapas || []).map((s, i) =>
    `<li class="etapa"><span class="etapa-num">${String(i + 1).padStart(2, '0')}</span><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p></li>`).join('');
  // Perguntas agrupadas: um subtítulo sempre que o grupo muda.
  const faq = (cfg.faq || []).map((f, i, arr) =>
    (f.grupo && f.grupo !== arr[i - 1]?.grupo ? `<h3 class="faq-grupo">${esc(f.grupo)}</h3>` : '') +
    `<details class="faq-item"><summary>${esc(f.pergunta)}</summary><p>${esc(f.resposta)}</p></details>`).join('');
  const historia = (cfg.historia || []).map(p => `<p>${esc(p)}</p>`).join('');
  const insta = String(ct.instagram || '').replace(/^@/, '');
  const fotoHtml = (src) => src
    ? `<img src="${esc(src)}" alt="${esc(cfg.titulo_pessoa || cfg.nome)}" class="foto">`
    : `<div class="foto foto-vazia" aria-hidden="true"><span>${esc(String(cfg.nome || '').split(/\s+/).map(p => p[0]).slice(0, 2).join(''))}</span></div>`;
  const foto = fotoHtml(cfg.foto);
  const foto_historia = fotoHtml(cfg.foto_historia || cfg.foto);
  const vars = {
    nome: esc(cfg.nome), pessoa: esc(cfg.titulo_pessoa || cfg.nome), oab: esc(cfg.oab), area: esc(cfg.area),
    descricao: esc(cfg.descricao), hero_titulo: esc(cfg.hero_titulo), hero_texto: esc(cfg.hero_texto),
    sobre_titulo: esc(cfg.sobre_titulo), sobre_texto: esc(cfg.sobre_texto), espaco_texto: esc(cfg.espaco_texto),
    telefone: esc(ct.telefone), zap: esc(zap), email: esc(ct.email), endereco: esc(ct.endereco),
    instagram: insta ? `<li><strong>Instagram</strong> <a href="https://instagram.com/${esc(insta)}" target="_blank" rel="noopener">@${esc(insta)}</a></li>` : '',
    mapa: ct.mapa ? `<iframe class="mapa" loading="lazy" title="Mapa" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(ct.mapa)}&output=embed"></iframe>` : '',
    instagram_cta: insta ? `<a class="btn btn-ouro" href="https://instagram.com/${esc(insta)}" target="_blank" rel="noopener">Acompanhe no Instagram @${esc(insta)}</a>` : '',
    ano: new Date().getFullYear(), destaques: cards(cfg.destaques, 'destaque'), areas: cards(cfg.areas, 'card'),
    etapas, faq, historia, foto, foto_historia,
    logo_rodape: cfg.logo_completo ? `<img src="${esc(cfg.logo_completo)}" alt="${esc(cfg.nome)} - ${esc(cfg.marca_subtitulo || '')}" class="logo-rodape">` : `<strong>${esc(cfg.titulo_pessoa || cfg.nome)}</strong>`,
    brand: brand(cfg), fontes: fontsLink(cfg), tema: `<style>${themeCss(cfg)}</style>`,
  };
  return fs.readFileSync(path.join(PUBLIC, file), 'utf8').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}

// ---------- Sessão ----------
function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function createSession() {
  const payload = Buffer.from(JSON.stringify({ u: ADMIN_EMAIL, exp: Date.now() + SESSION_HOURS * 3600e3 })).toString('base64url');
  return payload + '.' + sign(payload);
}

function readCookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(p => p.trim().split('=')).filter(p => p[0]));
}

function isAuthed(req) {
  const tok = readCookies(req).sessao;
  if (!tok) return false;
  const [payload, sig] = tok.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
}

function sessionCookie(value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `sessao=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ---------- Limite de tentativas (formulário e login) ----------
const hits = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}

// ---------- Utilidades HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };

function send(res, status, body, type = 'application/json; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...headers });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers['content-type']).startsWith('application/json')) return reject(new Error('json'));
    let data = '';
    req.on('data', c => { data += c; if (data.length > 20000) { reject(new Error('grande')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { reject(e); } });
  });
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

function serveStatic(res, rel) {
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep) || file.endsWith('.html')) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  return true;
}

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

// ---------- Rotas ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const html = (file) => send(res, 200, render(file), MIME['.html']);

  // Páginas públicas
  if (req.method === 'GET' && p === '/') return html('index.html');

  // Formulário de contato
  if (req.method === 'POST' && p === '/api/contato') {
    if (rateLimited('contato:' + clientIp(req), 5, 10 * 60e3)) return send(res, 429, { erro: 'Muitas mensagens em pouco tempo. Tente novamente mais tarde.' });
    let b;
    try { b = await readJson(req); } catch { return send(res, 400, { erro: 'Requisição inválida.' }); }
    if (b.site) return send(res, 200, { ok: true }); // campo-isca contra robôs
    const c = { nome: clean(b.nome, 120), email: clean(b.email, 160), telefone: clean(b.telefone, 40),
      assunto: clean(b.assunto, 160), mensagem: clean(b.mensagem, 4000) };
    if (!c.nome || !c.mensagem || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
      return send(res, 422, { erro: 'Preencha nome, e-mail válido e mensagem.' });
    }
    db.prepare('INSERT INTO contatos (nome, email, telefone, assunto, mensagem) VALUES (?, ?, ?, ?, ?)')
      .run(c.nome, c.email, c.telefone, c.assunto, c.mensagem);
    return send(res, 201, { ok: true });
  }

  // Login / logout
  if (req.method === 'GET' && p === '/painel/login') return html('painel/login.html');
  if (req.method === 'POST' && p === '/api/login') {
    if (rateLimited('login:' + clientIp(req), 8, 15 * 60e3)) return send(res, 429, { erro: 'Muitas tentativas. Aguarde 15 minutos.' });
    let b;
    try { b = await readJson(req); } catch { return send(res, 400, { erro: 'Requisição inválida.' }); }
    const ok = ADMIN_PASSWORD && safeEqual(String(b.email || '').toLowerCase(), ADMIN_EMAIL) && safeEqual(b.senha || '', ADMIN_PASSWORD);
    if (!ok) return send(res, 401, { erro: 'E-mail ou senha incorretos.' });
    return send(res, 200, { ok: true }, undefined, { 'Set-Cookie': sessionCookie(createSession(), SESSION_HOURS * 3600) });
  }
  if (req.method === 'POST' && p === '/api/logout') {
    return send(res, 200, { ok: true }, undefined, { 'Set-Cookie': sessionCookie('', 0) });
  }

  // Área protegida
  if (p === '/painel' || p.startsWith('/api/contatos')) {
    if (!isAuthed(req)) {
      return p === '/painel' ? send(res, 302, '', 'text/plain', { Location: '/painel/login' }) : send(res, 401, { erro: 'Faça login.' });
    }
    if (req.method === 'GET' && p === '/painel') return html('painel/index.html');

    if (req.method === 'GET' && p === '/api/contatos') {
      const rows = db.prepare('SELECT * FROM contatos ORDER BY criado_em DESC, id DESC').all();
      const resumo = Object.fromEntries(STATUS.map(s => [s, rows.filter(r => r.status === s).length]));
      return send(res, 200, { contatos: rows, resumo });
    }

    if (req.method === 'GET' && p === '/api/contatos.csv') {
      const rows = db.prepare('SELECT * FROM contatos ORDER BY criado_em DESC').all();
      const cols = ['id', 'criado_em', 'nome', 'email', 'telefone', 'assunto', 'mensagem', 'status', 'anotacoes'];
      const cell = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&") + '"';
      const csv = '﻿' + [cols.join(';'), ...rows.map(r => cols.map(c => cell(r[c])).join(';'))].join('\r\n');
      return send(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="contatos.csv"' });
    }

    const m = p.match(/^\/api\/contatos\/(\d+)$/);
    if (m && req.method === 'PATCH') {
      let b;
      try { b = await readJson(req); } catch { return send(res, 400, { erro: 'Requisição inválida.' }); }
      const atual = db.prepare('SELECT * FROM contatos WHERE id = ?').get(Number(m[1]));
      if (!atual) return send(res, 404, { erro: 'Contato não encontrado.' });
      const status = b.status !== undefined ? b.status : atual.status;
      if (!STATUS.includes(status)) return send(res, 422, { erro: 'Status inválido.' });
      const anotacoes = b.anotacoes !== undefined ? clean(b.anotacoes, 8000) : atual.anotacoes;
      db.prepare("UPDATE contatos SET status = ?, anotacoes = ?, atualizado_em = datetime('now') WHERE id = ?").run(status, anotacoes, atual.id);
      return send(res, 200, db.prepare('SELECT * FROM contatos WHERE id = ?').get(atual.id));
    }
    if (m && req.method === 'DELETE') {
      db.prepare('DELETE FROM contatos WHERE id = ?').run(Number(m[1]));
      return send(res, 200, { ok: true });
    }
  }

  if (req.method === 'GET' && serveStatic(res, p)) return;
  send(res, 404, 'Página não encontrada', 'text/plain; charset=utf-8');
}

http.createServer((req, res) => {
  handle(req, res).catch(err => { console.error(err); send(res, 500, { erro: 'Erro interno.' }); });
}).listen(PORT, () => console.log(`Site no ar em http://localhost:${PORT}  |  Painel: http://localhost:${PORT}/painel`));
