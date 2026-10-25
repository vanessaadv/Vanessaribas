const ROTULO = { novo: 'Novo', em_atendimento: 'Em atendimento', concluido: 'Concluído', arquivado: 'Arquivado' };
let contatos = [];
let selecionado = null;

const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, ...filhos) => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...filhos);
  return n;
};
const data = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json' } });
  if (r.status === 401) { location.href = '/painel/login'; throw new Error('sessão expirada'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro || 'Erro');
  return j;
}

async function carregar() {
  const j = await api('/api/contatos');
  contatos = j.contatos;
  $('#resumo').replaceChildren(...Object.entries(ROTULO).map(([k, v]) => {
    const b = el('button', { className: 'kpi' }, el('b', { textContent: j.resumo[k] }), el('span', { textContent: v }));
    b.onclick = () => { $('#filtro-status').value = k; desenharLista(); };
    return b;
  }));
  desenharLista();
  if (selecionado) mostrar(contatos.find(c => c.id === selecionado));
}

function desenharLista() {
  const termo = $('#busca').value.toLowerCase();
  const st = $('#filtro-status').value;
  const itens = contatos.filter(c =>
    (st ? c.status === st : c.status !== 'arquivado') &&
    [c.nome, c.email, c.assunto, c.telefone, c.mensagem].join(' ').toLowerCase().includes(termo));
  if (!itens.length) return $('#lista').replaceChildren(el('li', { className: 'vazia', textContent: 'Nenhum contato encontrado.' }));
  $('#lista').replaceChildren(...itens.map(c => {
    const li = el('li', { className: c.id === selecionado ? 'ativo' : '' },
      el('div', { className: 'linha1' }, el('span', { textContent: c.nome }), el('span', { className: 'selo ' + c.status, textContent: ROTULO[c.status] })),
      el('div', { className: 'linha2', textContent: `${data(c.criado_em)} · ${c.assunto || c.mensagem}` }));
    li.onclick = () => { selecionado = c.id; desenharLista(); mostrar(c); };
    return li;
  }));
}

function mostrar(c) {
  const d = $('#detalhe');
  if (!c) { d.className = 'detalhe vazio'; d.textContent = 'Selecione um contato para ver os detalhes.'; return; }
  d.className = 'detalhe';
  const linha = (rot, valor) => [el('dt', { textContent: rot }), el('dd', {}, valor)];
  const zap = (c.telefone || '').replace(/\D/g, '');
  const select = el('select', {}, ...Object.entries(ROTULO).map(([k, v]) => el('option', { value: k, textContent: v, selected: k === c.status })));
  const notas = el('textarea', { rows: 4, value: c.anotacoes, placeholder: 'Anotações internas (só aparecem aqui no painel)' });
  const aviso = el('span', { className: 'aviso' });
  const salvar = el('button', { className: 'btn', textContent: 'Salvar' });
  const excluir = el('button', { className: 'btn perigo', textContent: 'Excluir' });

  salvar.onclick = async () => {
    try {
      await api('/api/contatos/' + c.id, { method: 'PATCH', body: JSON.stringify({ status: select.value, anotacoes: notas.value }) });
      aviso.textContent = 'Salvo!'; aviso.className = 'aviso ok';
      carregar();
    } catch (e) { aviso.textContent = e.message; aviso.className = 'aviso erro'; }
  };
  excluir.onclick = async () => {
    if (!confirm(`Excluir o contato de ${c.nome}? Essa ação não pode ser desfeita.`)) return;
    await api('/api/contatos/' + c.id, { method: 'DELETE' });
    selecionado = null; mostrar(null); carregar();
  };

  d.replaceChildren(
    el('h2', { textContent: c.nome }),
    el('dl', {},
      ...linha('Recebido', data(c.criado_em)),
      ...linha('E-mail', el('a', { href: 'mailto:' + c.email, textContent: c.email })),
      ...linha('Telefone', zap ? el('a', { href: 'https://wa.me/' + (zap.length <= 11 ? '55' + zap : zap), target: '_blank', rel: 'noopener', textContent: c.telefone }) : '—'),
      ...linha('Assunto', c.assunto || '—')),
    el('p', { className: 'mensagem', textContent: c.mensagem }),
    el('div', { className: 'form' },
      el('label', {}, 'Status', select),
      el('label', {}, 'Anotações', notas),
      el('div', { className: 'botoes' }, salvar, excluir, aviso)));
}

$('#busca').oninput = desenharLista;
$('#filtro-status').onchange = desenharLista;
$('#sair').onclick = async () => { await fetch('/api/logout', { method: 'POST' }); location.href = '/painel/login'; };
carregar();
