# Site da Planeta Animal Agropet

Catálogo de produtos com sacola que fecha o pedido pelo WhatsApp da loja, e painel administrativo
para cadastrar produtos, categorias e os dados da loja.

- **Site:** página inicial, catálogo com filtros, páginas de categoria e de produto, ofertas, "A loja", busca ao vivo.
- **Sacola:** fica no navegador do cliente. Antes de fechar, o site confere no servidor os preços atuais.
  O pedido sai como mensagem pronta no WhatsApp da loja. Não há pagamento online e o site não guarda dados de clientes.
- **Painel (`/admin`):** produtos (fotos, opções de tamanho e preço, preço promocional, ficha técnica, selo, destaque),
  categorias, dados da loja, usuários do painel, troca de senha e registro de atividade.

## Rodar no computador

Precisa do Node.js 22.13 ou mais novo (testado no 24).

```bash
npm install
npm run seed
npm run criar-admin -- voce@email.com "Senha com 10 ou mais caracteres 123" "Seu nome"
npm start
```

Abra http://127.0.0.1:3000 (site) e http://127.0.0.1:3000/admin (painel).

- `npm run seed` cria categorias e alguns produtos de exemplo. Só funciona com o catálogo vazio.
- `npm run criar-admin` cria um acesso ou redefine a senha de um e-mail existente. **Não existe senha padrão.**
- `npm run artes` refaz as imagens do site a partir da pasta `../marca` (só se trocar alguma arte).

## Publicar na Vercel (grátis)

Na Vercel o site não tem disco: os dados ficam no **Turso** (banco) e as fotos no **Vercel Blob**. Os dois têm plano grátis.

1. **Banco (Turso):** crie uma conta em turso.tech e um banco (região mais perto: São Paulo, se houver).
   Na página do banco, copie a **URL** (`libsql://...`) e gere um **token**.
2. **Vercel > seu projeto > Settings > Environment Variables:** cadastre `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`.
3. **Fotos (Blob):** Vercel > seu projeto > aba **Storage** > **Create** > **Blob** > conecte ao projeto.
   A Vercel cria a variável `BLOB_STORE_ID` sozinha (ou `BLOB_READ_WRITE_TOKEN`, em projetos antigos).
4. **Redeploy:** aba Deployments > ⋯ no último deploy > Redeploy (as variáveis só valem em deploys novos).
5. **Primeiro acesso e produtos de exemplo:** no seu computador, crie um `.env` com as três variáveis
   (copie do `.env.example`; o `BLOB_READ_WRITE_TOKEN` está em Storage > seu Blob > `.env.local`) e rode:
   ```bash
   npm run criar-admin -- voce@email.com "Senha com 10 ou mais caracteres 123" "Seu nome"
   npm run seed
   ```
   Os comandos gravam direto no banco e no Blob do site publicado. O `seed` é opcional.
6. Abra o site e, em **/admin > Dados da loja**, preencha o WhatsApp, endereço e horário.

Limites: a Vercel aceita até 4,5 MB por envio, por isso o painel reduz as fotos no navegador e aceita até 6 por vez.

## Publicar em servidor próprio

Qualquer hospedagem que rode Node.js serve: VPS (Hostinger, DigitalOcean, Contabo), Railway, Render, Fly.io.
Sem as variáveis do Turso e do Blob, o site usa `data/loja.db` e a pasta `uploads/`.

1. Envie a pasta inteira, **menos** `node_modules/`, `data/` e `uploads/` (eles são criados no servidor).
2. No servidor: `npm install --omit=dev`.
3. Crie o arquivo `.env` a partir do `.env.example`:
   ```
   PORT=3000
   HOST=127.0.0.1
   NODE_ENV=production
   COOKIE_SECURE=1
   TRUST_PROXY=1
   ```
   `COOKIE_SECURE=1` exige HTTPS. `TRUST_PROXY=1` é para quando o site fica atrás de Nginx, Caddy ou do proxy da hospedagem.
4. Rode `npm run criar-admin -- ...` no servidor para criar o primeiro acesso.
5. Mantenha o processo no ar com `pm2 start server.js --name agropet` (ou o gerenciador da hospedagem).
6. Coloque HTTPS na frente (Caddy faz isso sozinho; com Nginx, use Certbot).
7. No painel, em **Dados da loja**, preencha o WhatsApp (é para ele que os pedidos vão), endereço, horário e Instagram.

### Backup

Na Vercel: o Turso guarda backups automáticos (veja o plano), e as fotos ficam no Blob.
Em servidor próprio: tudo que muda está em `data/` (banco `loja.db`) e `uploads/` (fotos). Copie as duas com frequência.

## Segurança (o que já vem pronto)

- Senhas com hash scrypt, bloqueio de 15 minutos após 5 tentativas erradas e limite de tentativas por IP no login.
- Sessão no servidor, cookie `HttpOnly` + `SameSite=Strict` (e `Secure` em produção), expira em 8 horas.
  Trocar a senha derruba as outras sessões da pessoa.
- Todo formulário do painel exige token CSRF e checa a origem da requisição.
- Todo texto exibido é escapado (sem injeção de HTML). Consultas ao banco sempre com parâmetros.
- Fotos enviadas são decodificadas e regravadas em WebP pelo `sharp`: somem metadados (EXIF/GPS) e arquivos disfarçados são recusados.
  Limite de 8 MB por foto.
- Cabeçalhos de segurança (CSP sem script inline, `nosniff`, `frame-ancestors 'none'`, HSTS em produção).
- `/uploads` só entrega as imagens geradas pelo próprio site; `data/`, `.env` e o código não são acessíveis pela web.
- Registro de atividade no painel: quem fez o quê e quando.

## Fontes

Relaxe (títulos, botões e preços) e Aminute (textos) ficam em `public/fonts/` e são servidas pelo próprio site.
**Confirme se a licença das duas cobre uso em site (webfont)**: os pacotes não trazem arquivo de licença.

A Relaxe não tem acentos desenhados. O `public/js/site.js` (e o `relaxe.js` no painel) compõe til, agudo,
circunflexo, crase e cedilha por cima das letras, sem alterar o arquivo da fonte. Na Relaxe, o alfabeto
principal está nas minúsculas, por isso os títulos usam `text-transform: lowercase`.

## Onde mexer

| O quê | Arquivo |
|---|---|
| Páginas do site | `src/views/paginas.js`, `src/views/layout.js`, `src/views/componentes.js` |
| Painel | `src/admin/views.js` (telas) e `src/admin/rotas.js` (regras e validação) |
| Banco e configurações padrão | `src/db.js` |
| Visual e animações | `public/css/site.css`, `public/js/site.js` |
| Artes (cenas e recortes) | geradas a partir de `../marca/fotos/cenas` por `scripts/preparar-artes.js` |

Os produtos de exemplo usam fotos oficiais de embalagens (Golden, Pedigree, Dreamies, Flexi) e preços ilustrativos.
Troque pelos produtos e preços reais da loja antes de publicar.
