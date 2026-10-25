const form = document.getElementById('form-contato');
const aviso = form.querySelector('.aviso');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(form));
  if (!dados.nome.trim() || !dados.email.includes('@') || !dados.mensagem.trim()) {
    aviso.textContent = 'Preencha nome, e-mail e mensagem.';
    aviso.className = 'aviso erro';
    return;
  }
  const botao = form.querySelector('button');
  botao.disabled = true;
  aviso.textContent = 'Enviando...';
  aviso.className = 'aviso';
  try {
    const r = await fetch('/api/contato', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.erro || 'Não foi possível enviar.');
    form.reset();
    aviso.textContent = 'Mensagem enviada! Em breve entraremos em contato.';
    aviso.className = 'aviso ok';
  } catch (err) {
    aviso.textContent = err.message;
    aviso.className = 'aviso erro';
  } finally {
    botao.disabled = false;
  }
});
