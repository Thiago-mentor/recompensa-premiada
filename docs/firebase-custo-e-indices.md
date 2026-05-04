# Firebase: índices e otimizações de custo

## Índice composto do ranking por vitória (PPT / Quiz / Reaction)

O app consulta a subcoleção `entries` dos rankings por jogo com ordenação composta:

`vitorias` (desc) → `score` (desc) → `partidas` (desc) → `atualizadoEm` (desc) → `__name__` (desc).

**Após alterar `firestore.indexes.json`, publique os índices:**

```bash
firebase deploy --only firestore:indexes
```

Com emuladores locais, o índice costuma ser criado automaticamente na primeira query; em **produção** o deploy acima é necessário. Enquanto o índice não existir, o cliente faz **fallback** para leitura completa da subcoleção (mais leituras; o ranking continua a funcionar). Em desenvolvimento aparece um `console.warn` se isso acontecer.

## Cache do documento `system_configs/economy`

- Implementação: `src/services/systemConfigs/economyDocumentCache.ts`
- **TTL:** 90 segundos (ajuste a constante `TTL_MS` se precisar de dados mais frescos ou de menos leituras).
- **Invalidação:** após guardar economia no admin (Configurações, Arena, Baús, Rankings) chama-se `invalidateEconomyConfigCache()` para o utilizador ver logo a config nova.
- **Exceção:** a sala PvP (`SalaClient`) mantém `onSnapshot` em `economy` para tempos de janela e boost durante a partida.

## Ranking de clãs na Central de ranking

O listener em tempo real de **todos** os documentos de `clans` só é ativado quando o utilizador escolhe visualizar um ranking **CLÃ** (`total_clan`, `daily_clan`, `weekly_clan`, `monthly_clan`). Páginas de clã (público, membros) continuam a precisar do board global.

## Listener partilhado de clãs

`subscribeClanRankingBoard` usa uma única subscrição Firestore partilhada por vários componentes até ninguém precisar; evita dois listeners ao mesmo tempo no mesmo browser.
