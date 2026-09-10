// Workspace names are controlled by deployment configuration, never by uploaded text.
export function companyKnowledge(companyId: string = "ende") {
  if (companyId !== "ende") throw Error("Esta empresa aún no tiene modelos y biblioteca habilitados. No se utilizarán los de otra empresa.");
  const workspace = process.env.ANYTHINGLLM_WORKSPACE || "adquisiciones-ende";
  if (!/^[a-zA-Z0-9_-]+$/.test(workspace)) throw Error("La biblioteca de la empresa tiene una configuración inválida.");
  return { id: "ende", name: "ENDE Deoruro S.A.", workspace };
}
