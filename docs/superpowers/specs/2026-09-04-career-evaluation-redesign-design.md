# Career Evaluation Redesign — Design Spec

**Scope:** `apps/api` (new `carreira` sub-resource), `packages/shared-types`, `apps/web` (`/gestao-carreiras`, gestor-only). No `apps/mobile` changes. No RH involvement anywhere — Gestão de Carreiras stays gestor-exclusive, as it already is today.

## 1. Goal

Replace the current "Avaliações → Ciclos" sub-tab (4 fixed criteria, 1-5 scale, no structure tying scores to promotion) with a richer evaluation built around the company's actual career-plan model: 5 princípios essenciais, 6 competências (hard/soft), a fixed 4-level salary ladder with per-level promotion requirements, and a calculated eligibility outcome the gestor acts on directly (gestor = diretoria for this purpose — no new role).

"1:1" and "Nine Box" sub-tabs are untouched. "Trilha" (`TrackRequirement`) and the `/colaboradores` promotabilidade badge (verde/amarelo/branco) are also untouched — see §9 for the known impact of retiring Ciclos on that badge.

## 2. Career ladder (fixed reference data)

Four levels, matching the existing `Employee.nivel` field (`"junior" | "pleno" | "senior" | "especialista"` — already live, already wired through the colaborador form/API/shared-types, per `packages/shared-types/src/employee-create.ts`). This is **not** the `cargo` field (which holds the real job function, e.g. `desenvolvedor`, `dba` — untouched by this feature).

The ladder is fixed in code (not gestor-editable), defined as a `CAREER_LADDER` constant in `packages/shared-types`:

| Nível | Label | Faixa salarial | Degraus fixos (R$) |
|---|---|---|---|
| `junior` | Analista Júnior | 2.500 – 3.800 | 2.500 / 2.900 / 3.400 / 3.800 |
| `pleno` | Analista Pleno | 4.000 – 6.200 | 4.000 / 4.700 / 5.500 / 6.200 |
| `senior` | Analista Sênior | 6.000 – 8.500 | 6.000 / 6.800 / 7.700 / 8.500 |
| `especialista` | Especialista / Consultor | 8.500 – 10.500 | 8.500 / 9.200 / 9.800 / 10.500 |

Each level's 4 steps are computed once as `min + round(i·(max−min)/3, nearest 100)` for `i = 0..3` (last step always equals `max`) and hard-coded as the table above — not recomputed at runtime.

Each level also carries the **requisitos to be promoted into it** (obrigatórios + eletivos), taken verbatim from the company's career-plan deck:

- **Júnior** — obrigatórios: "1 a 2 anos de experiência", "Graduação em andamento ou concluída". Eletivos: "Certificações não obrigatórias", "Habilidades em desenvolvimento", "Atuação sob supervisão".
- **Pleno** — obrigatórios: "Mais de 3 anos de experiência", "Graduação completa". Eletivos: "1 a 2 certificações", "Autonomia técnica", "Soft skills em evolução", "KPIs cumpridos".
- **Sênior** — obrigatórios: "3 anos ou mais como Pleno, com graduação completa", "Especialização desejável e no mínimo 3 certificações", "Soft skills consolidadas e referência técnica". Eletivos: "Habilidade comercial e insights de upsell", "Visão de Customer Success", "KPIs aprimorados", "Oportunidade de migração do modelo contratual".
- **Especialista** — obrigatórios: "Senioridade comprovada, com formação superior e especialização", "5 ou mais certificações e hard skills avançadas", "Liderança e referência estratégica". Eletivos: none.

A colaborador already at `especialista` has no next level — the requisitos-checklist and "Submeter para Decisão" sections are replaced with a "Nível máximo atingido" notice (princípios/competências scoring and "Agendar 1:1" remain usable for ongoing documentation).

## 3. Automatic salary-step progression

When a `CareerGoal` (existing model, `tipo: "pdi" | "entrega"`) transitions to `status: "concluida"`, the employee's `salarioMensal` automatically advances to the **next fixed step within their current `nivel`** (never crosses into the next level automatically — level-up only happens through §7's promotion flow).

Hook point: `CareerGoalsService.updateStatus` (`apps/api/src/carreira/metas.service.ts`). Add: when the new status is `"concluida"` and the previous status wasn't already `"concluida"` (idempotency — re-saving an already-completed goal must not advance twice), look up the employee's `nivel`, find the highest ladder step **at or below** their current `salarioMensal` within that level (this is the step they're effectively "on", even if `salarioMensal` doesn't land exactly on a step — e.g. someone hired at R$4.200 within Pleno's 4.000/4.700/5.500/6.200 ladder is treated as being on the 4.000 step), and advance `salarioMensal` to the **next** step after that one. If already on the level's top step (the 4th), no change — the employee stays capped until a real level-up occurs. If `nivel` is `null` or `salarioMensal` is below the level's first step, no change (nothing to advance from).

This is a deliberately simple, auditable rule — same fixed steps for everyone at a given level, no manager discretion, matching "para ser justo com todos os funcionários."

## 4. Data model

Replaces `PerformanceEvaluation`/"Ciclos" (4 flat int fields) with a normalized set of models, since a single evaluation now has 5 scored princípios + 6 scored competências + a variable-length requisitos checklist — too many columns for one flat row, and each list needs its own item-level text.

```prisma
model CareerEvaluation {
  id             String    @id @default(cuid())
  userId         String
  evaluatorId    String
  nivelAvaliado  String    // nivel the requisitos/media were evaluated against (redundant copy of Employee.nivel at save time, so history stays meaningful after future level-ups)
  proximoNivel   String?   // next level in the ladder at evaluation time, null if already no máximo
  status         String    // "rascunho" | "salva" | "decidida"
  resultado      String?   // "promovido" | "em_desenvolvimento" — set only when status = "decidida"
  mediaGeral     Float?    // average of the 11 scores, set on save
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  decidedAt      DateTime?

  principios     CareerPrincipioScore[]
  competencias   CareerCompetenciaScore[]
  requisitos     CareerRequisitoCheck[]
}

model CareerPrincipioScore {
  id             String   @id @default(cuid())
  evaluationId   String
  evaluation     CareerEvaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  principio      String   // "clareza" | "meritocracia" | "equilibrio" | "transparencia" | "desenvolvimento"
  nota           Int      // 0-10
  justificativa  String?

  @@unique([evaluationId, principio])
}

model CareerCompetenciaScore {
  id             String   @id @default(cuid())
  evaluationId   String
  evaluation     CareerEvaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  categoria      String   // "hard" | "soft"
  competencia    String   // key, e.g. "dominio_tecnico", "comunicacao_postura" — see §5
  nota           Int      // 0-10

  @@unique([evaluationId, competencia])
}

model CareerRequisitoCheck {
  id             String   @id @default(cuid())
  evaluationId   String
  evaluation     CareerEvaluation @relation(fields: [evaluationId], references: [id], onDelete: Cascade)
  tipo           String   // "obrigatorio" | "eletivo"
  label          String   // copied from the ladder's requisito text at save time
  atendido       Boolean  @default(false)
}
```

`PerformanceEvaluation` itself is **not dropped** — historical rows stay for whatever old data exists, and `promotabilidade.service.ts` keeps reading it unmodified (§9). Only the "Ciclos" *creation* path (controller/service/web sub-tab) is removed, since it's what this feature replaces.

## 5. Princípios & competências (fixed catalogs)

Five princípios (key → label → description, shown as read-only helper text next to each score input):

1. `clareza` — Clareza — "Entende sua posição, próximo passo e o que desenvolver."
2. `meritocracia` — Meritocracia Responsável — "Reconhece entregas, evolução e cultura."
3. `equilibrio` — Equilíbrio — "Combina técnica com postura, colaboração e visão de cliente."
4. `transparencia` — Transparência — "Conhece critérios, acompanha resultados e aceita o modelo."
5. `desenvolvimento` — Desenvolvimento Contínuo — "Busca capacitação, certificações, feedbacks e mentorias."

Six competências:

- Hard: `dominio_tecnico` ("Domínio Técnico & Aplicação Prática"), `qualidade_solucoes` ("Qualidade das Soluções & Entregas"), `kpis_tecnicos` ("Cumprimento de KPIs Técnicos").
- Soft: `comunicacao_postura` ("Comunicação & Postura com Cliente"), `organizacao_crises` ("Organização & Resolução de Crises"), `visao_estrategica` ("Visão Estratégica & Trabalho em Equipe").

Both catalogs live in `packages/shared-types` alongside `CAREER_LADDER`, as the single source of truth the API validates against (Zod enums) and the web form renders from (no hardcoded duplicate list in the component, unlike the pre-existing `CARGOS` duplication noted in colaborador-form-fields.tsx — avoid repeating that maintenance burden here).

## 6. Calculation & eligibility

- `mediaGeral` = average of all 11 scores (5 princípios + 6 competências), one decimal place.
- Eligibility (`resultado = "promovido"` if submitted): `mediaGeral >= 7` **and** every `CareerRequisitoCheck` with `tipo = "obrigatorio"` has `atendido = true`. Eletivos are informational differentials only — they don't gate the badge, matching the deck's "eletivos ampliam prontidão" framing.
- Badge shown live in the UI (recalculated client-side as the gestor edits, before saving): "Elegível para Promoção" / "Em Desenvolvimento" / "Nível Máximo Atingido" (if no próximo nível).

## 7. Screen structure (`/gestao-carreiras`, replaces the Ciclos sub-tab under Avaliações — becomes its own top-level tab, e.g. `?aba=avaliacao-carreira`)

1. **Cabeçalho** — colaborador selector (reuses existing `colaborador-select.tsx` pattern) + read-only summary card: Cargo Atual (nivel label), Tempo de Casa (from `hireDate`, existing computation reused from promotabilidade), Faixa Salarial Atual (current level's range, with the colaborador's current step highlighted, e.g. "R$ 4.000 – 6.200 (atual: R$ 4.700)"), Próximo Nível (label + its range), or "Nível máximo atingido" if at `especialista`.
2. **5 Princípios Essenciais** — one block per princípio: label + description text, nota input (0-10), justificativa textarea.
3. **Competências** — two groups (Hard Skills / Soft Skills), 3 nota inputs (0-10) each, no justificativa (matches the original ask — just scores here).
4. **Checklist de Requisitos do Próximo Nível** — two lists (obrigatórios / eletivos) pulled from `CAREER_LADDER[proximoNivel]`, one checkbox per item. Hidden (replaced by the "nível máximo" notice) if there's no próximo nível.
5. **Painel Final** — média geral (live-calculated), badge (§6), three buttons:
   - **Salvar Avaliação** — upserts the current evaluation as `status: "salva"` (creates on first save, updates in place on subsequent saves while still not decided — same colaborador + evaluator can only have one non-decided evaluation open at a time).
   - **Submeter para Decisão da Diretoria** — the client already knows `mediaGeral` and every requisito's checked state (live-calculated per §6), so eligibility is known *before* any API call. If eligible, clicking the button first shows a confirmation dialog ("Confirmar promoção de {nome} para {próximo nível}?"); canceling it makes no API call at all — the evaluation stays exactly as it was after the last "Salvar" (nothing becomes `decidida`). Only on confirm (or immediately, if not eligible — no dialog needed) does the client call `POST /carreira/evaluations/:id/decidir` with `confirmarPromocao` set to whether the gestor confirmed. The endpoint then, in one transaction: sets `status: "decidida"`, `decidedAt: now()`, `resultado` per §6, and — only when `resultado = "promovido"` and `confirmarPromocao: true` — updates `Employee.nivel` to the próximo nível and `Employee.salarioMensal` to that level's first step (§2's table, index 0). Once `decidida`, the evaluation is read-only; a new evaluation can be started for the next cycle.
   - **Agendar Reunião de 1:1** — opens the existing `OneOnOne` creation form (`one-on-ones.service.ts`), pre-filled with the selected colaborador's `userId` and a `pauta` seeded from the evaluation summary (e.g. "Avaliação de carreira — {nível atual} → {próximo nível}"). Reuses the existing endpoint/schema as-is; no changes to `OneOnOne`.

## 8. API surface (new)

All under `apps/api/src/carreira/evaluations/` (or similar), same guard pattern as every other `carreira` controller: `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('gestor')` per handler.

- `GET /carreira/evaluations/:userId` — most recent evaluation for a colaborador (any status), including nested princípios/competências/requisitos, or `null`.
- `POST /carreira/evaluations` — create or update-in-place the open (`rascunho`/`salva`) evaluation for `{userId, principios[], competencias[], requisitos[]}`; server computes `mediaGeral`, `nivelAvaliado`, `proximoNivel` from the current `Employee.nivel`.
- `POST /carreira/evaluations/:id/decidir` — transitions to `decidida`, computes `resultado`, and — only if the request body confirms (`{confirmarPromocao: boolean}`) and `resultado === "promovido"` — updates `Employee.nivel`/`salarioMensal` in the same transaction.

## 9. Known impact (not addressed by this feature)

`promotabilidade.service.ts`'s `mediaAvaliacao`/`mediaOk` (used for the `/colaboradores` verde/amarelo/branco badge) reads `PerformanceEvaluation` rows. Once Ciclos stops creating new rows, that axis freezes on each employee's last historical Ciclos evaluation (or stays `null` for anyone never evaluated there), permanently capping new/never-evaluated employees at `amarelo`/`branco` regardless of how well they do in the new evaluation. This is a real, known consequence of retiring Ciclos — left unaddressed here because it's a separate subsystem (the `/colaboradores` list badge, not the Gestão de Carreiras screen) not covered by the original ask. Flagging it so it isn't rediscovered as a mystery bug later; fixing it (e.g. sourcing `mediaOk` from the new `CareerEvaluation.mediaGeral` instead) is a natural, separate follow-up.

## 10. Design decisions made without explicit instruction ("seja criativo")

- Eligibility threshold of `mediaGeral >= 7` — no number was specified; 7/10 chosen as a reasonable majority-competence bar. Easy to change (single constant) if wrong.
- 4 salary steps per level, computed by even division rounded to the nearest R$100 — the user's example (2.500 → 2.900 → 3.200 → 3.500) was explicitly illustrative, not real figures.
- One open (non-decided) evaluation per colaborador at a time, rather than allowing multiple drafts in parallel.
- The "Submeter" confirmation dialog gates the entire decision (cancel = nothing saved as decided), rather than saving the decision record regardless and only gating the `Employee` update.
