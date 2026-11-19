# Roteiro e fala da apresentação: Chamada 112 em 5G SA (quinta geração, modo Standalone), Polaris x Equinox

**Duração-alvo:** 15 a 18 minutos de fala, mais perguntas.
**Divisão sugerida:** cinco blocos, um por integrante, seguindo as seis etapas do enunciado do Desafio 6. Ajustem os nomes conforme o combinado no grupo.

| Bloco | Slides | Etapa do desafio | Apresentador (sugestão) | Tempo |
|---|---|---|---|---|
| A | 1 a 4 | 1. Cenário e 2. Identificação do desvio | Alex | 3 min |
| B | 5 a 8 | 3. Análise do log | Joyce | 4 min |
| C | 9 a 12 | O DUT (Device Under Test, aparelho sob teste) se comporta como esperado? (3 desvios) | Julio | 3,5 min |
| D | 13 a 16 | 4. Eliminação de hipóteses e 5. Causa raiz | Marcos | 3,5 min |
| E | 17 a 21 | 6. Recomendação técnica e síntese | Silvio | 3,5 min |

**Fio condutor (repetir em todos os blocos):** a rede faz a mesma coisa com os dois aparelhos. A diferença nasce de uma decisão do próprio Polaris, no evento #21481.

---

## Bloco A — Cenário e sintoma (Alex)

### Slide 1 — Capa: "112 em 5G SA"
**Objetivo:** apresentar a pergunta que guia tudo.

> "Bom dia a todos. Nós somos Alex, Joyce, Julio, Marcos e Silvio, e vamos apresentar a investigação do Desafio 6: chamada de emergência 112 em 5G SA.
> A pergunta é simples: por que o Polaris, que está em homologação, leva 3,8 segundos para completar o 112, enquanto o Equinox, já homologado, leva 1,96?
> Para responder, fomos mensagem a mensagem nos logs dos dois aparelhos. Vamos mostrar o EPS (Evolved Packet System, núcleo de pacotes da rede de quarta geração) Fallback, a hierarquia de seleção de rede e o ponto exato em que os dois aparelhos se separam."

### Slide 2 — Cenário do teste
**Objetivo:** situar DUT, CDUT (Comparator DUT, aparelho de referência), rede e procedimento.

> "O cenário tem dois aparelhos, a mesma célula e a mesma discagem.
> De um lado, o Polaris, nosso DUT, uma unidade de pré-série. Do outro, o Equinox, o CDUT, da geração anterior e já homologado.
> A rede é a Zenith Telecom, PLMN (Public Land Mobile Network, rede móvel pública) 724/078, que é a operadora de origem dos dois. No site temos uma célula NR (New Radio, interface rádio do 5G) na banda n78, PCI (Physical Cell Identity, identidade física da célula) 88, e uma célula LTE (Long Term Evolution, tecnologia de quarta geração) banda 3, EARFCN (E-UTRA Absolute Radio Frequency Channel Number, número do canal de frequência LTE) 1444, no mesmo site.
> O procedimento foi discar 112 com o aparelho em 5G SA e, como controle, direto em 4G (quarta geração). Foram três repetições por cenário. O indicador é o tempo do evento Emergency Dial até a chamada estabelecida.
> Um detalhe importante para o resto da história: no mesmo ponto chega sinal da Aurora Móvel, PLMN 724/023, uma concorrente sem vínculo com o teste, com LTE na EARFCN 1300 e cobertura 2G (segunda geração).
> O aparelho ficou parado. O Polaris foi testado de manhã, a partir das 10h, e o Equinox à tarde, a partir das 14h."

### Slide 3 — O esperado: completar na própria operadora
**Objetivo:** definir a régua, ou seja, a hierarquia de seleção.

> "Antes de olhar os logs, precisamos saber o que é o comportamento correto.
> A célula 5G anuncia suporte a emergência, o EMC (Emergency Services Support, suporte a serviços de emergência), mas a Zenith não tem VoNR (Voice over New Radio, voz sobre o 5G). Então a chamada deve seguir por EPS Fallback.
> As normas TS (Technical Specification, especificação técnica do 3rd Generation Partnership Project, o 3GPP) 22.101 e TS 23.167 definem uma hierarquia. Primeiro, a própria operadora em 5G SA. Se falhar, a própria operadora em 4G, no LTE 1444 do mesmo site. Depois, a própria operadora em CS (Circuit Switched, comutação de circuitos), 2G ou 3G (terceira geração). E só como último recurso, qualquer outra PLMN, quando a própria operadora não tem nenhuma célula capaz.
> Cada nível só é tentado se o anterior realmente falhar. E um sinal mais forte de outra operadora não justifica, sozinho, trocar de PLMN.
> Já adiantando: o Equinox completa no nível 2. O Polaris pula direto para o nível 4."

### Slide 4 — O desvio só aparece quando a chamada nasce em 5G SA
**Objetivo:** mostrar em que condição diverge e em qual não diverge.

> "Comparando os quatro cenários, a diferença fica clara.
> Com origem em 5G SA, o Polaris leva em média 3,82 segundos e o Equinox 1,96. São 1,86 segundo a mais, quase o dobro. As faixas não se sobrepõem: o Polaris ficou entre 3,72 e 3,95, e o Equinox entre 1,88 e 2,05.
> No controle em 4G, a diferença praticamente some: 1,66 contra 1,58, só 80 milissegundos.
> Conclusão desta etapa: o problema não está no 4G nem no IMS (IP Multimedia Subsystem, subsistema multimídia sobre IP) em si. Está no que acontece entre o 5G e o 4G. É aí que a Joyce vai entrar no log."

---

## Bloco B — Análise do log (Joyce)

### Slide 5 — Até 0,58 s, os dois logs são idênticos
**Objetivo:** mostrar que a rede trata os dois aparelhos igual.

> "Obrigada, Alex. Pegamos a repetição 01 dos dois aparelhos e alinhamos as mensagens pelo tempo relativo à discagem.
> No tempo zero, os dois fazem o Emergency Dial e o RRC (Radio Resource Control, controle de recursos de rádio) Setup Request com causa emergency. Em 90 milissegundos vem o Service Request de emergência, em 150 o Service Accept, e em 200 o PDU (Protocol Data Unit, unidade de dados de protocolo) Session Establishment Request de emergência.
> Em 550 milissegundos, a rede responde com um DL (Downlink, enlace de descida) NAS (Non-Access Stratum, camada de sinalização entre aparelho e núcleo) Transport com 5GMM (5G Mobility Management, gerenciamento de mobilidade do 5G) cause 90, payload was not forwarded. Ou seja, a rede recusa a sessão de emergência.
> E em 580 milissegundos não chega nenhum RRC Release nem redirect. A rede não empurra o aparelho para o LTE. O EPS Fallback não acontece.
> O ponto-chave é que isso vale para os dois aparelhos, com os mesmos tempos. Então a rede tem um problema, mas ela não explica a diferença entre eles."

### Slide 6 — O ponto de divergência é uma decisão do próprio aparelho
**Objetivo:** apontar o evento #21481 como o divisor.

> "Logo depois da cause 90, cada aparelho registra um evento interno chamado PDU Session Failure Handling. E aqui os caminhos se separam.
> No Equinox, evento #21409, o log diz: next action, LTE cell selection. Em 50 milissegundos ele seleciona o LTE 1444 da Zenith, faz TAU (Tracking Area Update, atualização de área de rastreamento) com o GUTI (Globally Unique Temporary Identity, identidade temporária global) mapeado do 5G, abre a PDN (Packet Data Network, rede de dados por pacotes) de emergência com APN (Access Point Name, nome do ponto de acesso) sos, recebe 200 OK no IMS e completa em VoLTE (Voice over LTE, voz sobre o 4G) em 1,95 segundo.
> No Polaris, evento #21481, o log diz: next action, band scan. Ele varre NR e LTE por 0,45 segundo, escolhe o LTE 1300 da Aurora, faz attach de emergência com IMEI (International Mobile Equipment Identity, identificador do aparelho), recebe 403 no IMS e termina numa chamada CS em 2G da Aurora em 3,80 segundos.
> Mesmo estímulo da rede, duas decisões diferentes. É no evento #21481 que os logs se separam."

### Slide 7 — O Polaris enxerga a Zenith, mas escolhe a Aurora
**Objetivo:** provar que a HPLMN (Home PLMN, rede da operadora de origem) estava disponível.

> "Uma pergunta natural é: será que o Polaris não encontrou a Zenith? O log responde que encontrou.
> No Band Scan Result, evento #21531, o próprio Polaris lista o LTE 1444 da Zenith, no mesmo site, com -85 dBm (decibéis relativos a 1 miliwatt), uma célula perfeitamente utilizável. E lista o LTE 1300 da Aurora com -80 dBm.
> Na Cell Selection Decision, evento #21537, ele escolhe a Aurora.
> Ou seja, a escolha seguiu o maior RSRP (Reference Signal Received Power, potência recebida do sinal de referência), 5 dB (decibéis) a mais, e não a prioridade da operadora de origem."

### Slide 8 — Dois caminhos até a chamada estabelecida
**Objetivo:** decompor onde está o 1,85 s extra.

> "Nesta linha do tempo dá para ver para onde vai o tempo extra.
> Os primeiros 0,55 segundo são iguais nos dois. Depois, o Equinox gasta 0,75 em TAU e PDN sos e 0,55 em IMS e INVITE. Fecha em 1,95.
> O Polaris gasta 0,65 em varredura e decisão, 0,70 no attach na Aurora, 0,45 numa tentativa de IMS recusada e 1,45 no CSFB (Circuit Switched Fallback, retorno para comutação de circuitos) e na chamada CS em GERAN (GSM EDGE Radio Access Network, rede de acesso rádio 2G). Fecha em 3,80.
> Somando o extra: 0,55 segundo na seleção, 0,45 no IMS recusado e 0,90 do caminho CS frente ao VoLTE. O attach na Aurora foi 50 milissegundos mais curto que o TAU, o que fecha a conta de 1,85.
> Nas repetições 02 e 03 a variação aparece só na fase GERAN. O Julio agora vai mostrar se esse comportamento é aceitável."

---

## Bloco C — O DUT se comporta como esperado? (Julio)

### Slide 9 — Desvio 1: varredura completa em vez do LTE vizinho
> "Obrigado, Joyce. Comparando com a hierarquia do slide 3, encontramos três desvios encadeados.
> O primeiro é a varredura. Depois da mesma cause 90, o Equinox decide pelo LTE da Zenith em 50 milissegundos. O Polaris dispara uma varredura de NR mais LTE de 0,45 segundo e só decide em 1,20 segundo.
> O custo direto é de 0,55 segundo. Mas o pior é o efeito colateral: a varredura traz para a decisão células de outras operadoras. Isso abre caminho para o Desvio 2."

### Slide 10 — Desvio 2: troca de operadora com a HPLMN disponível
> "O segundo desvio é a troca de operadora. No evento #21537 o Polaris seleciona o LTE 1300 da Aurora. Nos eventos #21557 e #21558 ele faz um attach de emergência tipo 6, com IMEI, porque não tem contexto válido nessa rede.
> O Equinox, no mesmo momento, faz TAU com GUTI mapeado na Zenith, com EMC BS (Emergency Bearer Services, serviços de portadora de emergência) igual a 1 e IMS VoPS (IMS Voice over Packet Switched, voz sobre comutação de pacotes) igual a 1.
> Na prática, um assinante registrado na Zenith passa a se comportar como um visitante sem credenciais em outra rede. Isso viola a hierarquia e coloca o aparelho em serviço limitado."

### Slide 11 — Desvio 3: IMS de emergência numa célula que não o anuncia
> "O terceiro desvio está no SIB1 (System Information Block 1, bloco de informação de sistema 1) da Aurora, evento #21541. Ele não traz o campo ims-EmergencySupport-r9. Ou seja, a célula não anuncia suporte a emergência via IMS.
> Mesmo assim o Polaris tenta o IMS e recebe 403, Emergency registration not permitted. São mais 0,45 segundo perdidos.
> Só então ele faz CSFB para GERAN e completa uma chamada CS em 2G de outra operadora. O próprio log marca hplmn_used: no."

### Slide 12 — O mesmo estímulo, dois desfechos
> "Este slide resume a história em quatro passos.
> Passo 1, discagem: os dois em NR, tempo zero.
> Passo 2, resposta da rede: os dois recebem cause 90 sem redirect em 0,55 segundo.
> Passo 3, decisão do aparelho: aqui está a divergência. O Equinox vai para o LTE da Zenith. O Polaris varre, vai para a Aurora e faz attach com IMEI.
> Passo 4, desfecho: VoLTE na operadora de origem em 1,95 segundo, contra CS em 2G na concorrente em 3,80.
> Agora o Marcos vai mostrar por que podemos dizer que a causa é essa e não outra."

---

## Bloco D — Eliminação de hipóteses e causa raiz (Marcos)

### Slide 13 — O controle em 4G isola o problema
> "Obrigado, Julio. O cenário de controle em 4G foi decisivo.
> Nos cenários 3 e 4, os dois aparelhos fazem exatamente a mesma sequência, com os mesmos tempos, até o bearer de voz QCI (QoS Class Identifier, identificador de classe de qualidade de serviço) 1: RRC Connection Request, Service Request, PDN de emergência, registro IMS com 200 OK, INVITE para urn:service:sos.
> A diferença de 40 a 150 milissegundos só aparece entre o 180 Ringing e o 200 OK, que dependem da rede e do atendimento.
> Isso prova que a pilha IMS e VoLTE do Polaris, o SIM (Subscriber Identity Module, cartão do assinante), o perfil do assinante e a célula LTE da Zenith funcionam. O defeito está na transição a partir do 5G."

### Slide 14 — Hipóteses que os dados descartam
> "Cruzando os quatro cenários com os dois logs, descartamos as hipóteses uma a uma.
> Falha do núcleo 5G, a cause 90: é real, mas é igual nos dois aparelhos e nas seis repetições. Não explica a diferença.
> Cobertura do LTE da Zenith: o próprio scan do Polaris mostra -85 dBm, e o Equinox e o cenário 3 completam nela. Descartada.
> Pilha IMS do Polaris: o cenário 3 é idêntico ao 4. Descartada.
> SIM ou perfil: o Polaris registra na Zenith e recebe 200 OK no IMS de emergência. Descartada.
> E a lentidão da Aurora e do GERAN não é causa, é consequência. Ela só existe porque o aparelho escolheu essa rede."

### Slide 15 — O que os dados ainda não permitem descartar
> "Também precisamos ser honestos sobre o que ainda está em aberto. São quatro pontos.
> Primeiro, por que a rede manda cause 90. Isso exige traces AMF (Access and Mobility Management Function, função de acesso e mobilidade do núcleo 5G) e SMF (Session Management Function, função de gerenciamento de sessão do núcleo 5G) na interface N11, que o log do aparelho não mostra. Explica o fallback, mas não a diferença.
> Segundo, os horários diferentes: Polaris às 10h e Equinox às 14h. Carga e RF (radiofrequência) não foram controladas, mas a rede respondeu com os mesmos tempos aos dois. É pouco provável.
> Terceiro, a regra interna da escolha. O log mostra a decisão, mas não diz se o Polaris prioriza RSRP, se falta a lista HPLMN e EHPLMN (Equivalent HPLMN, redes equivalentes à de origem) ou se é configuração da pré-série.
> Quarto, a generalização. Nas três repetições a Aurora estava 5 dB mais forte. Não testamos a Zenith mais forte, e três repetições não dão certeza.
> Nenhum desses pontos contradiz a causa raiz. Eles a detalham ou a confirmam, e cada um tem um teste no slide 18."

### Slide 16 — Causa raiz: o Polaris ignora a prioridade da HPLMN
> "Com isso chegamos à causa raiz, rastreável mensagem a mensagem.
> No #21473 a rede recusa a sessão com cause 90, sem redirecionar. Isso é comum aos dois.
> No #21481 o Polaris decide fazer band scan, enquanto o Equinox seleciona o LTE da Zenith.
> No #21531 e #21537 ele escolhe a Aurora com -80 dBm e descarta a Zenith com -85, também utilizável.
> No #21557, attach de emergência com IMEI, em serviço limitado.
> No #21649, o IMS da Aurora recusa com 403, numa célula que não anunciava suporte.
> E do #21663 ao #21806, CSFB para GERAN e chamada CS em 3,80 segundos.
> A causa mais provável: o gerenciador de emergência do Polaris, após a falha da PDU Session sem redirecionamento, seleciona a célula por RSRP sem respeitar a prioridade da HPLMN. Isso gera a cascata attach limitado, IMS 403, CSFB para 2G, e o 1,86 segundo a mais.
> O Silvio fecha com a recomendação."

---

## Bloco E — Recomendação técnica e síntese (Silvio)

### Slide 17 — Correção proposta no Polaris
> "Obrigado, Marcos. Propomos três regras de recuperação, uma para cada desvio.
> Regra 1, ficar na própria operadora. Hoje o Polaris varre todas as bandas. A correção é ir direto ao LTE 1444 do mesmo site, com TAU usando o GUTI mapeado via N26 e PDN de emergência.
> Regra 2, outra operadora só no fim. Hoje ele troca a Zenith pela Aurora por 5 dB. A correção é usar outra PLMN só se a Zenith não tiver célula capaz. O sinal desempata células, não operadoras.
> Regra 3, respeitar o SIB1. Hoje ele tenta IMS sem o indicador e leva 403. Sem essa indicação, deve ir direto para o CS.
> A meta de aceitação é o cenário 1 depois da correção: 112 em 5G SA, cause 90, LTE 1444 da Zenith, VoLTE na operadora de origem em cerca de 2 segundos, como o Equinox."

### Slide 18 — Testes que confirmam a causa formalmente
> "Para fechar os pontos em aberto, propomos cinco testes.
> Um: atenuar ou bloquear a Aurora, em câmara blindada ou com atenuador na EARFCN 1300. Esperamos o Polaris no LTE 1444 completando em cerca de 2 segundos.
> Dois: inverter o sinal, com a Zenith mais forte. Se ele escolher a Zenith, fica provado que a decisão depende do RSRP e não da PLMN.
> Três: log interno detalhado do CallMgr (Call Manager, gerenciador de chamadas) e as listas PLMN e EHPLMN da pré-série, para identificar a regra.
> Quatro: DUT e CDUT ao mesmo tempo, no mesmo ponto, para eliminar o efeito do horário.
> Cinco: traces AMF e SMF da Zenith na N11 durante a cause 90, para corrigir a falha da rede, que é independente do aparelho."

### Slide 19 — Três repetições não dão certeza estatística
> "Um cuidado estatístico. Mesmo com faixas sem sobreposição, com três contra três repetições o menor p-valor bilateral possível no teste de Mann-Whitney é 0,10. Não chega aos 5% de significância.
> Para validar a correção, usamos a regra dos três: com n repetições sem desvio, a taxa de recorrência fica abaixo de 3 sobre n, com 95% de confiança. Com três repetições, ela pode chegar a 63%. Com trinta, cai para cerca de 9,5%.
> [Se a apresentação estiver interativa: arrastar o controle para mostrar a curva.]
> Por isso propomos pelo menos 30 repetições por cenário e por aparelho, no mesmo ponto e no mesmo período, registrando a PLMN final de cada chamada."

### Slide 20 — Síntese da investigação
> "Resumindo em quatro passos.
> Sintoma: 1,86 segundo a mais, só em 5G SA. Em 4G os aparelhos são equivalentes.
> Divergência: o evento #21481. Após a mesma cause 90, o Polaris varre as bandas em vez de ir ao LTE da Zenith.
> Causa raiz: a HPLMN é ignorada. Ele escolhe a Aurora pelo sinal e encadeia três desvios até o 2G.
> Próximo passo: corrigir a ordem de recuperação e confirmar com a Aurora atenuada, o RSRP invertido e pelo menos 30 repetições.
> A mensagem final é esta: a chamada de emergência do Polaris completa, mas pelo caminho errado. Fora da própria operadora, em 2G CS e com quase o dobro do tempo. E a rede também precisa investigar a cause 90."

### Slide 21 — Obrigado / Perguntas
> "Obrigado pela atenção. Estamos à disposição para perguntas."

---

## Preparação para perguntas

- **"Se a rede manda cause 90, a culpa não é da Zenith?"** A cause 90 explica por que o EPS Fallback não acontece. Mas os dois aparelhos recebem a mesma cause 90, e só o Polaris sai da operadora. A rede tem um problema próprio, e a diferença vem do aparelho.
- **"A Aurora estava mais forte. Não é razoável escolher o melhor sinal?"** Para emergência, a TS 22.101 e a TS 23.167 priorizam a operadora de origem enquanto ela tiver célula capaz. A Zenith a -85 dBm era utilizável, e o sinal só deve desempatar células dentro da mesma operadora.
- **"Por que o Polaris fez attach com IMEI?"** Ele não tem contexto válido na Aurora. Sem credenciais, o attach de emergência tipo 6 com IMEI o deixa em serviço limitado.
- **"O horário diferente dos testes não pode explicar?"** É um ponto em aberto, mas pouco provável. A rede respondeu com os mesmos tempos aos dois aparelhos, e o teste 4 elimina essa variável.
- **"Como vocês sabem que a decisão é por RSRP?"** O log mostra que a Aurora estava 5 dB mais forte e foi escolhida nas três repetições. A confirmação formal vem do teste 2, invertendo o sinal.
- **"Por que não usar VoNR?"** A Zenith não oferece VoNR. Por isso a emergência em 5G SA depende do EPS Fallback.
- **"Onde está o detalhamento completo?"** No relatório de issue do Polaris, que traz configuração, passos de reprodução e a evidência mensagem a mensagem.

## Dicas de apresentação

- Repitam o número do evento #21481 sempre que falarem da divergência. É a âncora da narrativa.
- Usem a frase de transição que está no fim de cada bloco para passar a palavra.
- Nos slides 5, 6 e 16, apontem as linhas da tabela enquanto falam, em vez de ler todos os números.
- Se o tempo apertar, resumam os slides 12 e 19, que repetem conteúdo já mostrado.
