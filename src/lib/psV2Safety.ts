export const PS_V2_OFFICIAL_WRITES_ENABLED = false as const;

export function assertPsV2OfficialWritesEnabled(action = 'Esta operação') {
  if (PS_V2_OFFICIAL_WRITES_ENABLED) return;
  throw new Error(`${action} está bloqueada no V2 enquanto o Processo Seletivo atual permanecer como ambiente oficial.`);
}
