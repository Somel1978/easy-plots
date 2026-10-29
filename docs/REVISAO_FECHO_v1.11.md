# Revisão de fecho — v1.11

As 125 decisões continuam a ser o objetivo obrigatório. Esta versão acrescenta implementação e regressões reais; não declara o produto pronto para a fase final de testes Foundry.

## Como ler a revisão

`DECISION_SCENARIO_REVIEW.csv` tem uma observação individual por decisão, fontes consultadas, ligações a casos locais efetivamente executados e limites explícitos. `tools/decision-review.json` contém a avaliação manual; `tools/review-decisions.py` valida referências, a execução da suíte completa e a impressão digital da fonte testada. O script não deduz conclusão semântica a partir do nome do teste.

| Categoria | Observações | Significado |
| --- | ---: | --- |
| `evidence-present` | 74 | Há comportamento relevante demonstrado localmente; não certifica toda a decisão. |
| `partial` | 48 | O cenário tem uma integração, funcionalidade ou evidência ainda incompleta, descrita individualmente. |
| `confirmed-gap` | 3 | Foi identificada uma ausência concreta no cenário revisto. |

Estes números não são uma percentagem de conclusão nem uma contagem de funcionalidades ausentes. Os 97 contratos candidatos continuam num inventário separado, cuja contagem não determina os resultados das 125 decisões. A estimativa em batches permanece indeterminada.

## Ausências concretas ainda registadas

- **ADR-037:** três cronologias indexadas distintas — ficção, execução e conhecimento por observador.
- **ADR-059:** ciclo incremental de arquivo de arcos concluídos e consulta lazy dos seus resumos.
- **ADR-081:** níveis configuráveis de fiabilidade na entrada e reconciliação de sinais críticos perdidos. Prioridade de execução não substitui esta garantia.

## Integrações e funcionalidades parciais a fechar

A lista detalhada é a coluna `observation` do CSV, sem converter incerteza em ausência. As frentes incluem: subgrafos mistos de dados/efeitos e continuação aprovada; convergência entre eventos; delegação por plot; templates e timelines alternativos; simulação de grafos publicados; NPCs/conhecimento/schedules persistentes; publicação autorizada de Chat/Journal; fila de revisão após correções; continuidade dos jobs após reinício; materialização/ativação de recursos; compatibilidade e versões dos eventos/providers; workflows GM/jogador e localização integral.

Algumas observações pedem uma regressão integrada de comportamentos já existentes, em vez de código novo. Por exemplo, o efeito aprovado do objetivo foi ligado ao domínio canónico e à projeção de quest nesta versão. Não se deve reconstruir serviços existentes sem primeiro verificar o percurso que falta.

Os critérios globais de qualificação, compatibilidade e rastreabilidade bidirecional também continuam parciais. Cada fecho deve acrescentar o comportamento que falta, o seu percurso integrado e a evidência positiva/negativa adequada, mantendo os testes automatizados durante o desenvolvimento.

## Validação deste checkpoint

773 testes Node aprovados, 0 falhas e 0 ignorados; 139 módulos com sintaxe validada; Chromium PASS; especificação/rastreabilidade e revisão da evidência PASS. Logs: `node-test-v1.11.log`, `browser-smoke-v1.11.log`, `spec-check-v1.11.log`; casos individuais: `local-test-evidence-v1.11.jsonl`.

As janelas foram testadas com DOM Chromium e serviços locais/mocks. Nenhum cenário final num mundo Foundry real foi executado. O alvo 14.369 do manifesto segue a estrutura pedida pelo autor, sem implicar certificação real.

Continuar diretamente a implementação a partir deste estado, sem pedir aprovação entre batches. Só depois do fecho funcional iniciar a bateria final Foundry, multi-clientes, permissões, carga, recuperação e migração.
