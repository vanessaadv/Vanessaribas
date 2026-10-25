# Site do escritório + painel de contatos

Site público com formulário de contato e painel com login para acompanhar os contatos recebidos.
Não precisa instalar nenhuma biblioteca: só o Node.js 22 ou mais novo.

## Como rodar

```bash
ADMIN_EMAIL=voce@seuescritorio.com.br ADMIN_PASSWORD='uma-senha-forte' SESSION_SECRET='texto-aleatorio-longo' node server.js
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/painel

Os contatos ficam salvos em `data/contatos.db` (SQLite). Faça backup desse arquivo.

## Identidade visual e textos

Tudo fica em `config.json`: nome, slogan, área, serviços, telefone, WhatsApp, e-mail, endereço,
cores (`primaria`, `secundaria`, `fundo`, `texto`), fontes do Google Fonts e o logo
(coloque o arquivo em `public/` e escreva o caminho, ex.: `"logo": "/logo.svg"`).
Não precisa reiniciar o servidor depois de editar.

## Painel

- Resumo por status: Novo, Em atendimento, Concluído, Arquivado
- Busca e filtro por status
- Detalhe do contato com link direto para e-mail e WhatsApp
- Anotações internas por contato
- Exportar planilha (CSV que abre no Excel)

## Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `ADMIN_EMAIL` | E-mail de acesso ao painel |
| `ADMIN_PASSWORD` | Senha do painel (obrigatória) |
| `SESSION_SECRET` | Chave das sessões; fixe uma para o login não cair ao reiniciar |
| `PORT` | Porta (padrão 3000) |
| `DB_PATH` | Caminho do banco (padrão `data/contatos.db`) |
| `NODE_ENV=production` | Ativa cookie seguro (use com HTTPS) |

## Hospedagem

Funciona em qualquer serviço que rode Node.js com disco persistente (Render, Railway, Fly.io, uma VPS).
