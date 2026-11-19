/** Organiza as respostas sem depender da ordem das perguntas. */
export function reportSections(game, answers) {
  const findings = [];
  let severity = null;
  game.report.forEach((question, index) => {
    const result = {
      question: question.q,
      expected: question.options[0],
      explanation: question.explain,
      ...answers[index]
    };
    if (question.field === "severity") severity = result;
    else findings.push(result);
  });
  return { severity, impact: game.impact, findings };
}
