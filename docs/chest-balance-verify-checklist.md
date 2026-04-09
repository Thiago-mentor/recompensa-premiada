# Checklist: balance-verify (sistema de baús MVP)

Use esta lista para fechar o todo **balance-verify**: conferir config no Firestore, fluxos no app (emulador ou staging) e limites de anúncio/idempotência.

## Pré-requisitos

- [ ] Emuladores ou projeto Firebase com **Auth + Firestore + Functions** alinhados ao app (`npm run emulators` no repo + `npm run dev`).
- [ ] Usuário de teste logado; opcional: admin em `/admin` para editar **`ChestSystemConfig`** (`ChestSystemConfigPanel`).
- [ ] Documento **`system_configs/chest_system`** existe e `enabled: true` para testes de concessão (se `false`, o backend não deve gerar baú — validar esse caso também).

## A. Documento `system_configs/chest_system`

Abra no Firestore (ou painel admin) e confira campo a campo (espelha `ChestSystemConfig` em `src/types/systemConfig.ts`).

| Campo | O que validar |
|--------|------------------|
| `enabled` | Liga/desliga o sistema; com `false`, nenhum grant novo (comportamento esperado documentado). |
| `slotCount` | Número de slots na UI; típico `4`. |
| `queueCapacity` | Tamanho máximo da fila; típico `4`. |
| `unlockDurationsByRarity` | Duração em **segundos** por `comum`, `raro`, `epico`, `lendario` (conferir se valores são os desejados para retenção, não apenas defaults). |
| `dropTablesBySource` | Para cada origem usada: `multiplayer_win`, `mission_claim`, `daily_streak` — pesos `weight` por `rarity`; somas coerentes com o produto (não precisam somar 100, mas a lógica de sorteio do backend deve estar clara). |
| `rewardTablesByRarity` | Intervalos `min`/`max` de `coins`, `gems`, `xp` (e o que mais existir no config) por raridade. |
| `bonusWeightsByRarity` + `bonusRewardTablesByRarity` | Bônus extra (ex.: fragmentos, boost, super prêmio) — pesos e ranges fazem sentido. |
| `adSpeedupPercent` | % do **tempo restante** retirada por anúncio (ex.: 33). |
| `maxAdsPerChest` | Teto de acelerações **por baú**. |
| `adCooldownSeconds` | Espera mínima entre acelerações no **mesmo** baú. |
| `dailyChestAdsLimit` | Máximo de anúncios de speedup **por usuário / dia** (conferir semântica no backend). |
| `pityRules` | `rareAt`, `epicAt`, `legendaryAt` — após N grants sem raridade, força escada de pity conforme implementação. |

**Origens no tipo (`ChestSource`):** `multiplayer_win`, `mission_claim`, `daily_streak`, `ranking_reward`, `event` — só exija drop table para o que está ativo no produto.

## B. Fluxos manuais no app (happy path)

Marque após executar no cliente conectado ao mesmo backend da config acima.

- [ ] **Vitória 1v1 elegível** → aparece baú (home/hub/sala conforme UX) com origem **Vitória multiplayer**.
- [ ] Baú em slot em estado **aguardando abertura** → **Iniciar/Começar abertura** → status **liberando** e countdown coerente com `unlockDurationsByRarity`.
- [ ] **Recarregar a página** durante o countdown → tempo e estado permanecem consistentes (snapshot servidor).
- [ ] **Acelerar com anúncio** (mock/SDK conforme ambiente) → tempo restante cai ~`adSpeedupPercent`% do que faltava; `adsUsed` / limites não ultrapassam `maxAdsPerChest`.
- [ ] **Cooldown** entre dois anúncios no mesmo baú → segunda tentativa dentro da janela falha ou é bloqueada com mensagem clara.
- [ ] Após esgotar **limite diário** de speedup → erro amigável até o próximo “dia” (conferir regra do day key no meta).
- [ ] Quando o timer termina → status **pronto** → **Coletar** credita saldo (PR/ticket/XP etc.) **uma vez**.
- [ ] **Claim antes de `readyAt`** (se conseguir forçar via cliente antigo ou replay) → servidor rejeita.

## C. Slots, fila e ocupação

- [ ] Com **todos os slots cheios**, o próximo grant vai para a **fila** (posição visível no hub).
- [ ] Ao **coletar** um baú pronto, um item da fila **sobe** para o slot livre (promoção).
- [ ] Cenário **fila cheia** + slots cheios (backlog full) → produto não perde grant sem aviso (mensagem/telemetria conforme implementação).

## D. Idempotência e duplicação

- [ ] Clicar **Coletar** duas vezes rápido (ou repetir request) → **uma** aplicação de recompensa; saldo não dobra.
- [ ] Repetir **start unlock** ou speedup em estado inválido → erro controlado, sem corromper documento do baú.

## E. Outros gatilhos (se ativos)

- [ ] **Missão** resgatada → grant com origem correta e tabela `mission_claim`.
- [ ] **Streak / login diário** com marco de baú → `daily_streak` e recompensa coerente.

## F. Conferência rápida no Firestore (dados)

Para um usuário de teste após um grant:

- [ ] `user_chests/{uid}/items/{chestId}` com `rarity`, `source`, `status`, `slotIndex` ou `queuePosition`, `rewardsSnapshot`, `unlockDurationSec`, timestamps `grantedAt` / `unlockStartedAt` / `readyAt` quando aplicável.
- [ ] Documento meta em `user_chests/{uid}` (se existir): contadores de pity e `dailySpeedupCount` / `dailySpeedupDayKey` alinhados aos limites.

## G. Encerramento do todo balance-verify

- [ ] Ajustes desejados já refletidos em **`system_configs/chest_system`** (e seed/admin, se usado).
- [ ] Registro breve de **cenários testados** e falhas encontradas (issue ou nota) para rastreio.

---

**Referência de plano:** `balance-verify` no arquivo de plano “Sistema Baús MVP” (Cursor plans).  
**Código:** callables e regras em `functions/src/index.ts`; UI hub em `src/modules/jogos/games/bau/BauGameScreen.tsx` e resumo em `src/components/chests/HomeChestSummaryCard.tsx`.
