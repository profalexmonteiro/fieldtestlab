export const EVIDENCE = {
  symptom: { label: "Sintoma", question: "Qual observação mostra o problema percebido no DUT?" },
  context: { label: "Contexto ou controle", question: "Qual observação ajuda a comparar condições ou avaliar uma hipótese alternativa?" },
  mechanism: { label: "Mecanismo", question: "Qual registro ajuda a explicar como ocorreu a falha?" },
  dl: { label: "Mecanismo em DL", question: "Qual registro ajuda a explicar a limitação no downlink do DUT?" },
  ul: { label: "Mecanismo em UL", question: "Qual registro ajuda a explicar o desvio no uplink do DUT?" }
};

export function evidenceTasks(items) {
  const directional = items.some(({ evidence }) => evidence === "dl" || evidence === "ul");
  return directional ? ["symptom", "context", "dl", "ul"] : ["symptom", "context", "mechanism"];
}

export function reviewAttachments(tasks, items, choices) {
  return tasks.map((role) => {
    const item = items[choices[role]];
    return { role, item, correct: item?.evidence === role };
  });
}
