# Current handover pointer — 29 October 2026

**Read [HANDOVER.md](HANDOVER.md), [MEMORY.md](MEMORY.md), and [NEXT_STEPS_UI.md](docs/NEXT_STEPS_UI.md) first.** Those entries supersede all completion/readiness and UI-restoration claims below. Product/UI incomplete; coding paused by the user; full-scope images and continuation instructions are preserved in GitHub. The exact agreed layout is still a design target. [57-image catalog](docs/design/full-scope-2026-10-29/README.md).

The remainder is historical transfer material, preserved for context; it does not authorize resuming implementation against the user's later image-only instruction.

---

# Current handover — 2026-10-29, v1.13.0-dev

The original v1.09 project was continued; do not restart it. All125 decisions have individual engineering reviews,97 candidate contracts have reviewed semantic mappings with explicit deviations, and there are **no implementation blockers** in the functional-entry gate. **1,147 actual Node cases PASS/0fail/0skip;214 runtime modules syntax PASS; global/spatial/convergence Chromium PASS; spec/review/qualification checks PASS.** `docs/QUALIFICATION_STATUS.json` and `docs/FULL_SCOPE_QUALIFICATION.csv` are the current evidence, not the historical counts below.

Next phase: final native Foundry qualification using `docs/FOUNDRY_FINAL_TESTS_v1.13.md` and the125-scenario CSV. ADR021 remains explicit final-native-only acceptance. No real Foundry world/multiplayer tests have run. The release compatibility matrix is deliberately blocked pending exact native evidence. Development setup never starts sockets, Hooks or world effects automatically.

Current MEMORY.md is concise and authoritative for continuation. The previous long memory is retained in docs/MEMORY_IMPLEMENTATION_HISTORY_pre-final-v1.13.md. Integration docs cover each parallel front. No commit, push, external publication or production release has occurred. The older source-transfer handover below is preserved solely as historical baseline.

---

# EASY PLOTS — HANDOVER TÉCNICO PARA NOVA CONVERSA

> **Atualização integrada v1.13 (2026-10-28):** este checkout continua a fonte original v1.09, sem reconstrução. Ler primeiro `MEMORY.md` e o delta v1.13. Verificação atual: **1030 casos Node PASS, 183 módulos, Chromium e spec/review PASS**. Foram acrescentados sinais críticos/eventos canónicos, subgrafos mistos, continuação verificada, simulação de grafos publicados, planos revistos enviados para propostas, agendas/conhecimento NPC, catch-up temporal e templates portáveis com instâncias de grafos. A missão das 125 decisões continua: 17 observações têm limites parciais, sem equivaler a funcionalidades ausentes. Nenhum teste final num mundo Foundry real foi executado.

**Data da transferência:** 28 de outubro de 2026  
**Projeto:** Easy Plots — módulo nativo para Foundry VTT v14+  
**Estado de referência verificado:** `v1.09.0-dev`  
**Natureza do estado:** implementação integrada em desenvolvimento; **não** é uma versão final validada em Foundry real.

> **Instrução primordial para o próximo assistente:** retomar a implementação **a partir do código do arquivo `Easy_Plots_Development_Workspace_v1.09.zip`**, não reconstruir o projeto a partir da conversa. Trabalhar através das restantes funcionalidades em batches consecutivos, sem solicitar aprovação ao utilizador entre batches. Executar os testes automatizados ao longo do desenvolvimento e reservar a validação manual/end-to-end em Foundry real para depois de concluída a implementação funcional. Não afirmar que existe execução em segundo plano entre mensagens.

## 1. Entregáveis desta transferência

- `Easy_Plots_Development_Workspace_v1.09.zip` — **fonte principal** (código, testes, especificações, documentação e ferramentas). Este é o ficheiro a carregar prioritariamente no novo chat.
- `Easy_Plots_Foundry_Module_v1.09_DEV.zip` — módulo instalável de desenvolvimento, com raiz `easy-plots/`; **não** substituir a fonte principal por este ZIP mais pequeno.
- `EASY_PLOTS_HANDOVER.md` — este documento técnico.
- `MEMORY.md` — memória concisa de objetivos, decisões, regras e estado.
- `Easy_Plots_Chat_Transfer_v1.09.zip` — pacote de conveniência que reúne os quatro ficheiros anteriores (exceto ele próprio).

Os caminhos `/mnt/data/...` aqui mencionados são relativos ao ambiente de trabalho da conversa original. **Não assumir que persistem noutra conversa**: o utilizador deverá carregar os ficheiros no novo chat.

## 2. Estado confirmado no momento da transferência

| Indicador | Estado verificado |
|---|---|
| Versão do `package.json` e `module.json` | `1.09.0-dev` |
| Último workspace disponível em disco | `easy_plots_v1.09/` |
| Testes automatizados Node | **640 aprovados / 0 falhados**, executados novamente nesta transferência |
| Validação da especificação | **PASS** |
| Smoke test de UI Chromium | **PASS** |
| Tipos de nós editáveis no código | **112** (`EDITABLE_NODE_TYPES`) |
| Contratos de nós candidatos originais | **97**, no catálogo de especificação |
| Decisões de arquitetura | **125**, com **125** cenários de aceitação propostos |
| Grupos de requisitos | **28** |
| Grupos lógicos de registos | **54** |
| ZIP do workspace | Arquivo verificado; 338 entradas, sem corrupção |
| ZIP do módulo | Arquivo verificado; 129 entradas, sem corrupção |
| Teste real de Foundry v14, vários clientes, permissões, sockets, cargas e migrações | **Ainda não executado/validado** |

**Importante:** 112 nós editáveis **não significam** que os 97 contratos propostos estejam cumpridos. Os respetivos IDs, portas, políticas de autorização e semânticas diferem em muitos casos. É necessária **rastreabilidade semântica um-para-um**. Os testes locais aprovados não certificam os 125 cenários de aceitação em Foundry real.

A última atualização visível na conversa do utilizador referia v1.03 e 629 testes durante o desenvolvimento, mas a fonte e os pacotes finais efetivamente disponíveis neste ambiente avançaram até **v1.09 e 640 testes**. Usar a v1.09 como baseline, salvo se o utilizador apresentar outra versão mais recente.

## 3. Objetivo final e regras de entrega — decisões vinculativas do utilizador

1. **Um único módulo completo** Easy Plots, com implementação de todas as **125 decisões arquiteturais** acordadas. Não propor um MVP reduzido como entrega final.
2. **Foundry VTT v14+ nativo** (fontes locais de referência: v14 Stable build 369), sem servidor, backend, base de dados, worker externo ou serviços auxiliares obrigatórios.
3. Usar batches incrementais, paralelização quando útil, e integrar tudo no mesmo workspace. **Não parar entre batches a pedir “continue”, aprovação ou testes manuais.**
4. Durante a implementação: testes Node, de contrato, segurança, browser e mocks de Foundry para depuração e regressão. **A bateria manual/end-to-end real em Foundry é no fim**, depois de todas as funcionalidades programadas estarem implementadas.
5. Não aplicar gates de lançamento/produção a cada batch, nem chamar «finalizado» ao que ainda não cobre todas as decisões.
6. Entregar ficheiros e código efetivo, não apenas planos, resumos ou pseudo-código. Não prometer trabalho assíncrono após terminar a resposta.
7. Distinguir o que é comprovadamente funcional do que está pendente. Não confundir API simulada com compatibilidade real comprovada.
8. Não mudar silenciosamente os contratos, os princípios de segurança, a arquitetura de armazenamento ou o âmbito; manter documentação de desvios e testes correspondentes.

## 4. Arquitetura e invariantes

- **Autoridade do GM:** escritor nativo designado, contexto GM de confiança, autorização contextual de Actor, encaminhamento seguro de pedidos e controlo de mudança de GM. Efeitos relevantes seguem **evento → avaliação do grafo publicado → proposta → revisão/aprovação GM → diário de efeitos → execução verificada/reconciliação**.
- **Proveniência causal:** identificadores estáveis, revisões, histórico imutável para acontecimentos publicados, correlacionar eventos, aprovações e operações, rejeitar replays e não repetir automaticamente efeitos de resultado incerto.
- **Armazenamento:** Compendiums/documentos nativos da world, repositórios revisionados, partições e índices limitados, páginas de grafos, leitura seletiva/lazy, sem varrer todos os plots num evento.
- **Segurança e informação:** fonte canónica GM-privada versus projeções allowlisted por observador; não revelar existência de informação oculta, contagens privadas, IDs protegidos ou critérios secretos aos jogadores; autenticar remetente através do contexto verificado do Foundry, nunca apenas de um campo declarado no socket.
- **Grafo:** rascunho ≠ publicação imutável ≠ ativação; validação das portas, tipos, ciclos, versões de subgrafos e providers; triggers por origem com proveniência autenticada.
- **Narrativa:** NPC com identidade/persona/Actor opcional; facções, relações, dívidas, conhecimento/rumores, pistas/investigações, objetivos/quests, tempo, locais, decisões de arco, blueprints, planeamento/simulações. Propostas não equivalem a consequências já ocorridas.
- **Fail closed:** capacidade nativa não verificada ou sem API necessária deve recusar operação. Nenhuma mutação em instalação/bootstrap ou em simulação isolada. Nunca garantir atomicidade entre documentos que o Foundry não fornece.

## 5. Estrutura relevante do workspace

```text
Easy_Plots_Development_Workspace_v1.09.zip
├── package.json                       # Node >=22, ES modules
├── module.json                        # Foundry module id: easy-plots; mínimo v14
├── src/
│   ├── bootstrap/index.mjs            # Hooks, API pública, composição GM/player
│   ├── contracts/                     # IDs, validações, erros e digest
│   ├── graph/                         # Registos, tipos de nós, validação, publicação
│   ├── editor/                        # Modelo de edição/nós editáveis
│   ├── runtime/                       # Router, providers, efeitos, causalidade, revisão GM
│   ├── security/                      # Authority, writer, projeções, request gate
│   ├── storage/                       # Native Pack, índices, journals, migrações, páginas
│   ├── domains/                       # Knowledge, quests, NPC, facções, investigações,
│   │                                  # relações, tempo, arcos, localizações, blueprints…
│   ├── platform/                      # Foundry hooks, sockets, Actors/Items, Journal,
│   │                                  # notificações, rolls e player transport
│   └── ui/                            # ApplicationV2 GM desks e player portal
├── static/easy-plots.css
├── tests/                              # Testes Node e browser
├── spec/                               # Fonte da verdade das 125 decisões e 97 contratos
├── docs/                               # Deltas e relatórios históricos
└── tools/                              # Check source, packaging, probes, coverage
```

**Ficheiros prioritários da especificação:**

- `spec/Decision_Register_125.csv`
- `spec/Full_125_Decision_Acceptance_Matrix.csv`
- `spec/Domain_Node_Provider_Catalog.csv` e `.json`
- `spec/Traceability_Matrix.csv`
- `spec/Easy_Plots_Technical_Spec_v0.2.md`
- `spec/Foundry_Trust_Boundaries_v0.2.md`
- `spec/Agent_Handoff_and_Integration.md`
- `spec/Parallel_Batches_and_Agent_Contracts_v0.2.md`
- `spec/Document_and_Index_Storage_Map.csv`
- `docs/IMPLEMENTATION_DELTA_v0.99-v1.09.md`
- `docs/PROPOSED_NODE_CONTRACT_TRACE_v0.50.csv` (documento histórico, **desatualizado**, não assumir equivalência total).

## 6. Funcionalidades existentes no baseline integrado

As versões v0.3–v0.98 implementaram incrementalmente: repositório nativo protegido, editor Graph ApplicationV2, grafos publicados/ativação, eventos duráveis, revisão GM, provider registry, estados e milestones, facções, relações, investigações, conhecimento por observador, NPC/agendas/schedules, locais/rotas, tempo e índices due, arcos/endings, blueprints, simulações e Planning Lab, votação, quests/objetivos, resource binding e materialização segura de Journal/Actor/Item, inspeção/refs inversas, migrações, co-GM, alertas e entrega autenticada de notificações, Session Handoff Desk, search protegido e player boards. Existem muitos testes locais; as partes não devem ser confundidas com validação integral do catálogo original.

**Alterações v0.99–v1.09, já incluídas:**

| Batch | Implementação |
|---|---|
| v0.99 | Transporte autenticado para player: recaps autorizados e resultado final de votação; verificação de propriedade de Actor e projeção restrita |
| v1.00 | Integração do transporte na composição nativa; interface de continuidade do jogador |
| v1.01 | Publicações de quests revisionadas e protegidas por destinatário, com objetivos e IDs públicos separados |
| v1.02 | Consulta `quest-board` por transporte seguro; API de preparar/rever/aprovar |
| v1.03 | ApplicationV2 GM Quest Publication Desk e testes de interface |
| v1.04 | Triggers distintos `core.trigger.manual`, `core.trigger.schedule-due`, `core.trigger.document-event` com validação de proveniência |
| v1.05 | Player Narrative Portal para recaps, votação, quests e investigações |
| v1.06 | GM Manual Event Desk, sem conceder aprovação implícita dos efeitos |
| v1.07 | Teste de integração local quest → aprovação → transporte GM/player e supressão de projeções obsoletas |
| v1.08 | Troca do tipo de trigger no editor, defaults válidos e identidade do nó estável |
| v1.09 | `core.state.read`, branch de comparação segura do estado nativo, com portas match/mismatch/absent e falha fechada |

**Limite importante de `core.state.read`:** o contrato candidato original `easy-plots.core.state-read` descreve `in:entity;out:value` (dados tipados). O nó implementado **não** fornece saída arbitrária de valor tipado; apenas comparação/branching. Não considerá-lo semanticamente equivalente sem completar ou formalizar o contrato.

## 7. Problemas conhecidos e verificação inicial recomendada

1. **Constante de versão desfasada:** `src/bootstrap/index.mjs` contém `const VERSION='1.08.0-dev'`, embora `module.json` e `package.json` indiquem **`1.09.0-dev`**. Corrigir e testar no próximo batch de integração.
2. **Cobertura dos nós originais:** `tools/report-coverage.py` contém mapeamentos aproximados e escreve para `docs/PROPOSED_NODE_CONTRACT_TRACE_v0.50.csv` — não é auditoria semântica atualizada. Reconstruir matriz de cobertura: contrato original → equivalente(s) real(is) → portas/tipos/semântica → integração → testes positivos/negativos → estado exato.
3. **112 tipos de nós editáveis** (medidos no código); o catálogo inicial contém 97 IDs e não há correspondência por contagem. Não atribuir cumprimento integral com base em números de nós.
4. **Foundry real não validado:** storage permissions, sockets, isolamento GM/player, transição co-GM, Foundry dnd5e, concorrência, migrações, performance e compatibilidade ainda necessitam validação final.
5. **Contratos propostos/aceitação:** a matriz CSV de 125 testes usa frequentemente `Proposed; never executed` para cenários Foundry. Os 640 testes locais são testes de implementação/mocks, não prova automática de cumprimento da matriz inteira.
6. **Fonte de referência:** `/mnt/data/Foundry.zip` e `/mnt/data/foundryvtt_dist.zip` estiveram disponíveis na conversa original. Se o próximo chat precisar de inspecionar internals, estes ficheiros terão de ser carregados novamente; não estão incluídos por defeito no pacote compacto.

## 8. Próximos batches — continuar sem pedir autorização

**P1 — Normalizar e auditar a cobertura:** corrigir o identificador de versão; atualizar matriz contrato 97×implementação; identificar semânticas em falta com base no catálogo e CSV de aceitação, não apenas em títulos de nós. Priorizar `core.state-read` com portas de dados reais, tipos/eventos/joins/subgrafo, e os contratos nativos ainda não representados. Criar testes de contrato ligados a IDs da especificação.

**P2 — Implementação completa de providers:** completar os contratos especializados ainda sem implementação equivalente; integrar cada provider em editor → validação/publicação → subscrição/evento → execução segura → testes. Não adicionar nós «de catálogo» sem comportamento e persistência efetivos.

**P3 — Domínios e interfaces:** fechar workflows complexos de NPC/facções, knowledge propagation, investigações, quest, tempo e arcos; projeções de jogador, automação de facções, handoffs e vistas de GM; assegurar referência/revisão/proveniência consistente.

**P4 — Nativo e cooperação:** game-system adapters (dnd5e e outros apenas quando suportados e verificados), sistema de rolls/Combat/Chat/Actors/Items, co-GM segurança e recuperação, migrações/index repair, permissões e contratos de transporte; não adulterar mocks para esconder bugs.

**P5 — Conclusão:** apenas quando toda a implementação estiver presente, proceder à validação integral num mundo real Foundry v14, testes multi-clientes/hostis/performance/migração, correções e pacote final. Não antecipar essa fase por cada batch; os testes automatizados correm continuamente.

A ordem P1–P4 pode ser paralelizada por workstream, mantendo contratos partilhados e testes integrados. Seguir o projeto e o estado efetivo, não um número arbitrário de versões.

## 9. Reproduzir os testes e gerar a distribuição

Requisitos locais: Node.js **22+** e Python 3; Chromium/headless disponível conforme `tests/browser/editor-smoke.py`.

```bash
cd easy_plots_v1.09
npm run check                   # source checks + node --test tests/*.test.mjs
npm run spec:check              # decisão/contrato/esquema e TS proposals
python tests/browser/editor-smoke.py
```

**Resultados obtidos e reconfirmados no handover:** 640/640 testes Node, spec PASS, Chromium PASS. O `tools/package.sh` fornece a base de empacotamento; confirmar estrutura da raiz `easy-plots/` no ZIP e fazer teste de integridade antes de disponibilizar arquivos. As distribuições existentes v1.09 foram verificadas, sem membros ZIP corrompidos.

O módulo é exposto por `game.modules.get('easy-plots').api` em `src/bootstrap/index.mjs`; a configuração nativa privilegiada exige `configureVerifiedNative(...)` e atestação/transportes de remetente verificáveis. O modo sandbox não pode efetuar efeitos nativos.

## 10. Texto a enviar no primeiro pedido do novo chat

> **Continua a implementar Easy Plots a partir do workspace v1.09 que anexei.** Lê primeiro `EASY_PLOTS_HANDOVER.md`, `MEMORY.md`, os 125 ADR e o catálogo dos 97 contratos. Não recomeçar o projeto nem pedir aprovação entre batches: implementa os restantes subsistemas e contratos até a arquitetura estar completa, com testes automatizados incrementais e integração no mesmo módulo. Só realizar os testes end-to-end reais em Foundry após conclusão da implementação. Não confundir 112 nós registados com equivalência dos 97 contratos. Corrige primeiro a versão desfasada do bootstrap, atualiza a rastreabilidade semântica e continua o desenvolvimento. Entrega novos ZIPs da fonte e do módulo com resultados de testes e falhas/limitações explicitamente identificadas.

---

**Fim do handover.** Este documento reflete o conteúdo e os testes executados no ambiente original em 28-10-2026; prevalecem sempre os ficheiros efetivamente carregados na nova conversa.
