# FieldTestLab · Simulador de Testes de Campo 5G SA

Simulador web para estudo de casos de teste de campo em redes móveis 5G SA. Ele reproduz, mensagem a mensagem, logs reais de modem e de interface aérea. Também mostra a topologia do teste, KPIs que mudam a cada evento e o resultado consolidado de cada cenário, e gera um relatório de issue no modelo da disciplina.

O objetivo é apoiar a análise investigativa dos desafios: comparar DUT × CDUT, localizar no call flow o ponto em que a sinalização diverge do esperado e chegar a uma causa raiz rastreável às evidências.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Desafios incluídos](#desafios-incluídos)
- [Como executar](#como-executar)
- [Como usar](#como-usar)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Arquitetura](#arquitetura)
- [Conteúdo e dados](#conteúdo-e-dados)
- [Idiomas](#idiomas)
- [Tema e identidade visual](#tema-e-identidade-visual)
- [Fidelidade às fontes](#fidelidade-às-fontes)
- [Compatibilidade](#compatibilidade)

---

## Funcionalidades

- **Reprodução de logs reais.** As mensagens são lidas diretamente dos arquivos HTML de log fornecidos no material, sem cópia nem alteração. A reprodução respeita os timestamps da captura e permite controlar a velocidade (0,25× a 4×), avançar e voltar evento a evento, ou clicar numa mensagem para pausar nela.
- **KPIs em tempo real.** Para cada evento, o painel mostra o procedimento em curso (rejeição NAS com a causa, RLF, critério S, tentativas de Msg1, handover, reestabelecimento…), a tentativa ou sequência, a célula, o PLMN/SUCI ou a medição, e o tempo.
- **Mesma base de tempo do caso.** Quando o documento do desafio mede os tempos a partir de um evento específico (por exemplo, a *Measurement Configuration #2*), o simulador usa a mesma referência. Os valores na tela são, então, os mesmos do documento.
- **Topologia animada.** A cena mostra as duas gNodeB/eNodeB e o UE. Uma seta indica a direção da mensagem atual: uplink, downlink ou evento interno.
- **Evidência de medição (Desafio 2).** Um painel com quatro abas, calculado direto dos logs:
  - **Medição e corrida:** RSRP da serving (n78) e da vizinha (n41) contra os limiares de entrada do A5, BLER filtrado contra o Qout de 10 %, os temporizadores T310/T304 e a cadência de medição da n41 sobre o padrão de gaps, com o DUT e o CDUT sobrepostos. Marcos numerados (A5 atendido, fim do TTT, out-of-sync, T310, report, RLF…) e um resumo dos fatos medidos. Clicar no gráfico leva a reprodução ao evento.
  - **DUT × CDUT:** os três cenários no mesmo eixo de tempo, as diferenças calculadas (atraso do report, retorno do serviço, tempo gasto na PCI 88) e a tabela do caso.
  - **Acesso aleatório:** rampa de potência de cada Msg1 contra a potência máxima, pathloss, critério S da célula e a melhor célula que o próprio UE já tinha medido.
  - **Hipóteses e conclusão:** cada hipótese com suas evidências, que levam direto à linha do log; o aluno marca as que descarta, e a conclusão (mecanismo, limiar efetivo aparente e estatística com Fisher exato e IC 95 %) fica atrás do botão *Mostrar conclusão*.
- **Corrida da mobilidade na cena.** Durante a reprodução, um anel em volta do UE mostra o T310 (ou o T304 no handover), e uma faixa abaixo da cena diz há quanto tempo o A5 está atendido sem report e quanto faltava do T310 quando o report saiu. Depois do RLF, a cena destaca a célula que o UE já tinha medido.
- **Modo guiado.** Cada log do Desafio 2 tem um roteiro de pontos-chave. A reprodução pode pausar em cada um, com uma explicação curta e navegação para o ponto anterior e o seguinte.
- **Resultado consolidado.** Métricas, faixas de tempo das repetições, evidências e avisos sobre os limites de cada fonte.
- **Relatório de issue.** Segue a estrutura do template *Relatorio_Issue_G2.docx*, com exportação para PDF pela impressão do navegador.
- **Glossário de siglas e códigos.** O botão **Glossário**, no topo, abre uma tabela com 99 termos (RRC, NAS, medição, RLM, RACH, códigos 0xB9xx do log do modem, estatística), com busca que ignora acentos, filtro por categoria e opção de mostrar só os termos do desafio atual.
- **Português e inglês**, com troca de idioma sem recarregar a página.
- **Tema claro e modo noturno**, com a escolha lembrada pelo navegador.
- **Layout responsivo**, utilizável em celular.

## Desafios incluídos

### Desafio 1 — Registro / Attach (5G SA e LTE)

Rejeições em cascata no registro 5G SA do **Aurora** (DUT) após troca de perfil de eSIM/pSIM entre operadoras, comparado ao **Boreal** (CDUT).

| Cenário | Aparelho | Troca de perfil | RAT | Fonte da reprodução |
|---|---|---|---|---|
| 01 · DUT | Aurora | Vantis (724/085) → Zenith (724/078) | 5G SA | Log `Desafio_S02_Log_DUT_Aurora.html` |
| 02 · DUT | Aurora | Zenith (724/078) → Nimbus (724/091) | 5G SA | Etapas resumidas do caso |
| 03 · Controle | Aurora | Vantis → Zenith | LTE | Etapas resumidas do caso |
| 04 · Referência | Boreal | Vantis → Zenith | 5G SA | Log `Desafio_S02_Log_CDUT_Boreal.html` |

Fontes: `Desafio 1/Desafio_Semana_2.docx` e os dois logs da pasta `Desafio 1/`.

### Desafio 2 — Mobilidade 5G (handover inter-frequência e RLF)

Radio Link Failure do **Meridian** (DUT) no handover inter-frequência n78 → n41, com reestabelecimento atrasado, comparado ao **Solstice** (CDUT).

| Cenário | Aparelho | Mobilidade | Fonte da reprodução |
|---|---|---|---|
| 01 · Controle | Meridian | Intra-frequência n78 (PCI 88 → 101) | Etapas e horários da repetição 01 do caso |
| 02 · DUT | Meridian | Inter-frequência n78 → n41 (PCI 145/160) | Log `Desafio_S03_Log_DUT_Meridian.html` |
| 03 · Referência | Solstice | Inter-frequência n78 → n41 | Log `Desafio_S03_Log_CDUT_Solstice.html` |

Fontes: `Desafio 2/material/Desafio_S03_Caso_Aluno.docx` e os dois logs da pasta `Desafio 2/`.

## Como executar

O simulador é um site estático, sem etapa de build e sem dependências. Ele usa módulos JavaScript e carrega os dados com `fetch`, por isso **precisa ser servido por HTTP**. Ao abrir o `index.html` com duplo clique (`file://`), o navegador bloqueia o carregamento dos dados; a página avisa quando isso acontece.

Use qualquer uma das opções abaixo, a partir da pasta do projeto:

| Opção | Comando / ação | Endereço |
|---|---|---|
| VS Code | Extensão **Live Server** → *Open with Live Server* no `index.html` | aberto automaticamente |
| Node.js | `npx serve .` | `http://localhost:3000` |
| Python | `python -m http.server 8000` | `http://localhost:8000` |

Para os alunos, o projeto também pode ser publicado sem alterações em qualquer hospedagem de arquivos estáticos (GitHub Pages, Netlify, servidor da instituição).

## Como usar

1. Escolha o desafio nas abas e o cenário na barra lateral.
2. Em **Reprodução passo a passo**, clique em **▶ Reproduzir** ou use **Anterior / Próximo** para avançar evento a evento.
3. Acompanhe a cena e os **KPIs em tempo real**. A página não se move sozinha durante a reprodução; só a lista de eventos acompanha a mensagem atual.
4. Clique numa linha do log para pausar nela. Use **Ver decodificação completa** para ler todos os IEs da mensagem.
5. No Desafio 2, ative o **Modo guiado** para a reprodução parar nos pontos-chave, e use o painel **Evidência de medição** para comparar o DUT com o CDUT. A conclusão só aparece quando o aluno clica em **Mostrar conclusão**.
6. Compare com o **Resultado consolidado**, as **Faixas de tempo** das repetições e as **Evidências** do cenário.
7. Em **Fontes e entregáveis**, abra o log original, visualize o relatório de issue ou exporte-o em PDF.

## Estrutura do projeto

```
.
├── index.html                 Página (somente marcação)
├── css/
│   └── app.css                Estilos e tokens de tema (claro / noturno)
├── js/
│   ├── main.js                Inicialização: estado, idioma, tema e telas
│   ├── store.js               Estado único da aplicação
│   ├── data.js                Carga dos desafios, logs e relatórios
│   ├── replay.js              Motor de reprodução (sem DOM)
│   ├── analyzer.js            Classificação dos eventos para os KPIs
│   ├── insights.js            Evidência de medição: séries, marcos, A5, T310, RACH (sem DOM)
│   ├── i18n.js                Textos da interface (pt-BR / en)
│   ├── prefs.js               Preferências do usuário (tema, idioma)
│   ├── dom.js                 Utilitários de DOM e formatação
│   └── views/
│       ├── scenario.js        Cabeçalho, barra lateral, métricas, timeline, evidências
│       ├── scene.js           Cena SVG (gNodeB, UE, enlaces)
│       ├── signaling.js       Seta da mensagem atual sobre a cena
│       ├── dashboard.js       KPIs em tempo real
│       ├── playback.js        Controles e lista de eventos
│       ├── race.js            Corrida A5/T310/T304 sobre a cena
│       ├── guide.js           Modo guiado (pontos-chave do log)
│       ├── insight.js         Painel de evidência e gráfico de medição
│       ├── insight-common.js  Utilitários compartilhados pelas abas
│       ├── compare.js         Aba DUT × CDUT
│       ├── rach.js            Aba de acesso aleatório
│       ├── hypotheses.js      Aba de hipóteses, conclusão e estatística
│       ├── modals.js          Log original e relatório de issue
│       └── glossary.js        Glossário de siglas e códigos
├── data/
│   ├── desafios.json          Índice dos desafios e cenário inicial
│   ├── desafio-1.json         Conteúdo do Desafio 1 (pt-BR, base)
│   ├── desafio-2.json         Conteúdo do Desafio 2 (pt-BR, base)
│   ├── glossario.json         Glossário: categorias e termos (pt-BR, base)
│   ├── relatorios/            Relatórios de issue (pt-BR)
│   └── i18n/en/               Traduções em inglês (somente textos)
├── Desafio 1/                 Material original do Desafio 1 (caso, logs, apresentação)
└── Desafio 2/                 Material original do Desafio 2 (caso, logs, apresentação)
```

## Arquitetura

```
data/*.json ──► data.js ──► store.js ◄── replay.js ◄── analyzer.js
                               │
                               ▼
                         views/* (DOM)
```

- **Dados separados do código.** Cada desafio é um arquivo JSON. Incluir um desafio novo não exige alterar o JavaScript.
- **Estado único** (`store.js`): desafio e cenário selecionados, e o estado do replay (eventos, índice, reproduzindo/pausado, mensagem). As telas apenas leem o estado e se redesenham quando ele muda.
- **Motor de replay** (`replay.js`): carrega os eventos, controla o temporizador e a velocidade e publica o estado. Não manipula o DOM. Intervalos longos sem mensagens no log (acima de 2 s) são comprimidos na reprodução, com aviso na tela.
- **Evidência de medição** (`insights.js`): a partir dos eventos do log, extrai as séries de RSRP por camada, o BLER, o instante em que a condição de entrada do A5 passa a valer (TS 38.331, com a hysteresis), o report, o RLF, o início do T310 (inferido como RLF − T310, porque o log não registra esse instante), as tentativas de RACH e a cadência de medição. As mesmas funções alimentam o gráfico, a corrida na cena e as comparações.
- **Analisador** (`analyzer.js`): classifica cada evento uma única vez, no carregamento, a partir do nome da mensagem e do resumo. A decodificação completa não é usada para classificar, porque contém termos incidentais (por exemplo, `Purpose : RLF` nas estatísticas de RLM) que gerariam rótulos falsos.
- **Sem build e sem dependências externas.** HTML, CSS e módulos ES nativos.

## Conteúdo e dados

### Incluir um desafio

1. Crie `data/desafio-N.json` seguindo a estrutura dos existentes.
2. Acrescente o caminho em `data/desafios.json`, na lista `challenges`.
3. Crie o relatório em `data/relatorios/desafio-N.html`. O marcador `{{data}}` é substituído pela data de geração.
4. Opcional: crie a tradução em `data/i18n/en/` (veja [Idiomas](#idiomas)).

### Campos principais de um desafio

| Campo | Descrição |
|---|---|
| `id`, `tab`, `tag`, `title`, `description` | Identificação e textos do cabeçalho |
| `cellPanel` | `"identity"` (mostra PLMN/SUCI) ou `"measurement"` (mostra measId e RSRP/RSRQ) no KPI de célula |
| `sideInfo`, `materials` | Resumo da barra lateral e links para o material do aluno |
| `report.title`, `report.template` | Título e arquivo do relatório de issue |
| `scenarios` | Lista de cenários (tabela abaixo) |
| `insights` | Opcional. Ativa o painel de evidência: camadas `serving`/`target` (`arfcn`, `pci`, `band`), `a5` (`measId`, `threshold1`, `threshold2`, `hysteresis`, `tttMs`, `apparentThreshold2`), `rlm` (`outOfSyncBler`, `t310Ms`), `gap` (`mgrpMs`, `mglMs`) e `pair` = `[id do DUT, id do CDUT]` |
| `comparison` | Linhas da tabela DUT × CDUT do caso e `counts` de RLF (`{ "dut": [3, 3], "cdut": [0, 3] }`) para o teste de Fisher |
| `hypotheses`, `conclusion` | Hipóteses com evidências (`links` para `{ scenario, idx }`), vereditos e a conclusão mostrada sob demanda |

### Campos de um cenário

| Campo | Descrição |
|---|---|
| `id`, `number`, `label`, `kicker`, `title`, `description`, `status`, `statusClass` | Identificação e textos |
| `device`, `state`, `rat`, `network` | Rótulos da cena |
| `leftNode`, `leftCell`, `rightNode`, `rightCell` | Células de origem e destino. Os PCIs definem para qual lado a seta aponta. |
| `scene` | `"failure"`, `"control"` ou `"reference"` (cores da cena) |
| `metrics`, `rows`, `axisMax`, `evidence`, `notice` | Resultado consolidado, faixas de tempo, evidências e aviso |
| `logPath`, `logLabel` | Log original a reproduzir e sua descrição |
| `timeReference` | `{ "idx": 38, "label": "…" }`: evento do log usado como T 0, igual ao documento do caso |
| `playbackSteps` | Etapas resumidas (`msg`, `summary`, `offsetMs`), usadas quando **não há** log. Se existir log, prefira `logPath`. |
| `guide` | Roteiro do modo guiado: `[{ "idx": 54, "title": "…", "text": "…" }]`, com `idx` = número da linha no log |
| `stepsTimed` | `true` quando os `offsetMs` são horários reais informados no caso, não uma cadência didática |

### Glossário

`data/glossario.json` tem `categories` (`id`, `label`) e `terms` (`id`, `term`, `category`, `challenges`, `name`, `description`). O campo `challenges` lista os desafios em que o termo aparece (`"desafio-1"`, `"desafio-2"`) e alimenta o filtro "Só termos do desafio". A tradução em `data/i18n/en/glossario.json` traz apenas os textos, indexados pelo `id`.

### Formato dos logs

Os logs são os arquivos HTML interativos do material. O simulador lê o bloco embutido:

```html
<script id="log-data" type="application/json">[ { "idx": 1, "ts": "…", "msg": "…", "summary": "…", "cell": "PCI 201 / NR-ARFCN 633120", "direction": "UL", "full": "…" }, … ]</script>
```

Campos usados: `idx`, `ts`, `attempt` (opcional), `rat`, `protocol`, `channel`, `direction`, `msg`, `summary`, `cell` e `full`.

## Idiomas

- **Interface:** os textos ficam em `js/i18n.js`, um bloco por idioma.
- **Conteúdo:** os JSON em `data/` são a base em português. As traduções em `data/i18n/<idioma>/` contêm **apenas os textos**. Números, células e tempos continuam num único lugar e são mesclados no carregamento: listas por posição e cenários pelo `id`.
- **Relatórios:** há uma versão HTML por idioma.

## Tema e identidade visual

As cores são definidas como variáveis CSS no topo de `css/app.css`, a partir da paleta da marca:

| Token | Cor | Uso |
|---|---|---|
| `--brand-orange` | `#FF6B00` | Destaque principal: botões, progresso, seleção |
| `--brand-navy` | `#0A192F` | Texto (tema claro) e fundo (modo noturno) |
| `--brand-blue` | `#172A45` | Elementos secundários e painéis do modo noturno |
| `--brand-mist` | `#F4F6F9` | Fundo (tema claro) e texto (modo noturno) |
| `--brand-white` | `#FFFFFF` | Painéis (tema claro) |

As combinações de texto e fundo atendem ao contraste mínimo de 4,5:1 (WCAG AA). Por isso, o texto em laranja usa uma variação mais escura (`#B54800`), e os botões laranja levam texto azul noturno.

## Fidelidade às fontes

Os dados exibidos foram conferidos contra os documentos dos casos e os logs. Pontos que o professor e os alunos devem conhecer:

- **Desafio 1:** o documento não informa a qual troca o log do Aurora corresponde. A duração do log (4,55 s) coincide com a troca 03.
- **Desafio 1:** o log do Boreal dura 0,82 s, menos que os tempos totais do cenário 4 no caso (0,98–1,15 s). O documento não define o instante inicial da medição.
- **Desafio 1:** o resumo dos cenários 1 e 2 cita a faixa 4,55–4,80 s, mas os valores individuais das trocas vão até 4,77 s e 4,75 s, respectivamente. O simulador exibe as faixas calculadas a partir dos valores individuais.
- **Desafio 2:** nos cenários 2 e 3, todos os tempos são medidos a partir da *Measurement Configuration #2* (evento 38 dos logs), como no documento do caso.

Essas observações também aparecem nos avisos dos cenários e nos relatórios.

## Compatibilidade

Navegadores atuais com suporte a módulos ES e `color-mix()` em CSS: Chrome/Edge 111+, Firefox 113+ e Safari 16.2+. As animações respeitam a preferência de sistema "reduzir movimento".
