# Revisão de fecho — v1.12

Esta versão implementa as cronologias distintas e o arquivo incremental de arcos no projeto existente, com regressões e interface integradas. As 125 decisões continuam obrigatórias. O produto permanece em desenvolvimento.

## Evidência atual

797 casos Node executados e aprovados, 0 falhas e 0 ignorados; 143 módulos com sintaxe validada; Chromium PASS; especificação, inventário e revisão da evidência PASS. Logs: `node-test-v1.12.log`, `browser-smoke-v1.12.log`, `spec-check-v1.12.log`. Os casos individuais e a impressão digital da fonte estão em `local-test-evidence-v1.12.jsonl`.

`DECISION_SCENARIO_REVIEW.csv` contém uma observação individual por decisão. A avaliação é manual e as referências são verificadas contra testes realmente executados. O script não deduz conclusão semântica a partir de nomes ou contagens de nós.

| Categoria | Observações | Significado |
| --- | ---: | --- |
| `evidence-present` | 76 | Há comportamento relevante demonstrado localmente; não certifica a decisão inteira. |
| `partial` | 48 | Há funcionalidade, integração ou evidência por completar, descrita na respetiva nota. |
| `confirmed-gap` | 1 | Uma ausência concreta continua registada no cenário revisto. |

Estes números não são uma percentagem de conclusão, uma contagem total de funcionalidades ausentes ou uma estimativa em batches. O inventário dos 97 contratos candidatos é um documento distinto.

## Fechos demonstrados nesta versão

- **ADR-037:** eixos indexados de ficção, aceitação registada do evento e disponibilidade de conhecimento por observador, com ordenação causal e paginação. Datas antigas desconhecidas continuam desconhecidas; o estado de execução não é apresentado como consequência aprovada.
- **ADR-059:** arquivo de arco concluído, manifestos explicitamente revistos, retenção por páginas, cursor persistente, recuperação após interrupção e resumo lazy. A seleção do histórico é explícita; as fontes e os recursos mantêm-se preservados.
- Correção integrada relacionada: uma divulgação recente já não conta como conhecimento disponível no passado por ter `availableAt` anterior. Projeções de observador, agendas e forecasts usam o mesmo limite temporal.

## Fronteira ainda pendente

O cenário **ADR-081** continua sem níveis configuráveis de fiabilidade na entrada e sem reconciliação de sinais críticos perdidos. A prioridade do escalonador e o journal após aceitação não estabelecem esta garantia.

As **48 notas parciais** continuam a fazer parte do trabalho. Incluem subgrafos mistos e continuação aprovada, convergência entre eventos, delegação por plot, templates e timelines alternativas, simulação de grafos publicados, integração persistente de NPCs/schedules/conhecimento, publicação Chat/Journal autorizada, fila de revisão após correções, catch-up/reconciliação, reparticionamento e índices gerais, materialização/ativação de recursos, workflows GM/jogador, localização e contratos de compatibilidade/qualificação.

Algumas notas pedem uma regressão integrada de serviços existentes, em vez de reconstrução. Consultar cada `observation` antes de alterar a implementação. O novo arquivo só estabelece o seu próprio cursor de retenção; não fecha, por associação, o catch-up de jobs temporais ou toda a arquitetura de índices.

Nenhum cenário final num mundo Foundry real foi executado. A bateria final de Foundry, multi-clientes, permissões, carga, recuperação e migração só começa após o fecho funcional. Continuar a implementação sem pedir aprovação entre batches.
