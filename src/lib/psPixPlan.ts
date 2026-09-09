export function normalizePix(value: unknown): string {
  const pix = typeof value === 'string' ? value.trim() : '';
  return /^sem\s+pix$/i.test(pix) ? '' : pix;
}

export function preparePixPlan<T extends { id: string; pix?: string | null; full_name?: string }>(collaborators: T[], overrides: Record<string, string>) {
  // Validate the whole selection before any persistence call.
  return collaborators.map(collaborator => {
    const pix = normalizePix(overrides[collaborator.id] ?? collaborator.pix);
    if (!pix) throw new Error(`Informe o PIX de ${collaborator.full_name || 'o fiscal selecionado'} antes de vincular.`);
    return { collaborator, pix, changed: pix !== normalizePix(collaborator.pix) };
  });
}

export async function persistPixPlan(plan: ReturnType<typeof preparePixPlan>, save: (id: string, pix: string) => Promise<void>) {
  for (const item of plan) if (item.changed) await save(item.collaborator.id, item.pix);
}
