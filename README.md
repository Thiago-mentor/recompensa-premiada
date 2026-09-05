# Rivaliza

Aplicação de gamificação com missões, jogos solo e PvP, clãs, rankings, sorteios,
anúncios recompensados e carteira virtual. Os pedidos de saque PIX são registrados
pelo cliente e revisados/pagos manualmente no painel administrativo.

## Arquitetura

- Next.js 16 e React 19 no App Router.
- Firebase Authentication, Firestore, Storage, App Check e Analytics.
- Cloud Functions v2 em Node.js 22 para toda mutação de economia e autorização sensível.
- Firebase App Hosting para a aplicação web.
- Capacitor para Android/iOS, carregando a URL HTTPS do App Hosting.
- AdMob Rewarded Ads com validação SSV no backend.

O frontend nunca grava diretamente saldos, extratos, partidas, sorteios ou saques.
Essas operações passam por HTTPS Callables e transações no backend. As regras do
Firestore e Storage complementam essa fronteira.

## Desenvolvimento local

Requisitos: Node.js 22, npm e Java para os emuladores Firebase.

```bash
npm ci
npm --prefix functions ci
copy .env.example .env.local
npm run emulators
```

Em outro terminal:

```bash
npm run dev
```

Preencha as variáveis Firebase de `.env.local`. Para usar os emuladores, mantenha
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`. Mocks de anúncio só devem ser usados no
emulador ou por uma conta administradora em ambiente controlado.

## Verificações

```bash
npm run lint
npm run typecheck
npm test
npm run test:emulators
npm run build
npm run audit:prod
```

`npm run verify` executa lint, tipos, testes unitários e builds. Os testes de regras
sobem os emuladores de Firestore e Storage separadamente.

## Configuração de segurança

App Check é exigido por padrão nas Functions fora dos emuladores. A chave pública
Web fica em `NEXT_PUBLIC_APPCHECK_SITE_KEY`. Para um diagnóstico temporário, o
enforcement pode ser desativado explicitamente com `ENFORCE_APP_CHECK=false` durante
o deploy; não mantenha essa opção em produção.

As coleções `unique_usernames`, `referral_codes` e `rate_limits` são internas e só
podem ser acessadas pelo Admin SDK. Uma Function agendada remove diariamente os
contadores de rate limit expirados; o TTL do Firestore pode ser habilitado como
camada adicional usando o campo `rate_limits.expiresAt`.

Nunca versione `.env.local`, chaves de conta de serviço, keystores ou credenciais.

## Deploy

Cloud Functions:

```bash
npm --prefix functions run build
npm run deploy:functions
```

Regras:

```bash
npm run deploy:rules
```

App Hosting:

```bash
npm run deploy:apphosting
```

O workflow de CI usa Node.js 22, executa todas as verificações e bloqueia builds com
vulnerabilidades conhecidas nas dependências de produção.

## Capacitor

Defina `CAPACITOR_SERVER_URL` em `.env.local` com a URL HTTPS do App Hosting e rode:

```bash
npm run cap:sync:android
npm run cap:sync:ios
```

Os scripts validam a URL antes de sincronizar, impedindo que um pacote de produção
seja gerado apontando para a página placeholder. HTTP é aceito apenas para hosts de
desenvolvimento local.

## Organização do código

- `src/app`: rotas web e shells de autenticação/admin.
- `src/services`: acesso a Firebase e Callables.
- `src/modules/jogos`: telas, engines e fluxo compartilhado dos jogos.
- `functions/src`: regras de negócio e endpoints do backend.
- `firestore.rules` e `storage.rules`: autorização de acesso direto.
- `test` e `functions/test`: testes de regras e testes unitários do backend.
- `docs`: checklists operacionais e decisões específicas de domínio.

Ao adicionar uma operação que altera economia, use transação no backend e grave o
lançamento de carteira na mesma transação com identificador determinístico.
