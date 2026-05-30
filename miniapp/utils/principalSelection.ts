import type { PrincipalSummary } from "@auction/shared";

type PrincipalOption = Pick<PrincipalSummary, "id">;

export function normalizePrincipalSelection(principals: readonly PrincipalOption[], selectedPrincipalId: string): string {
  const principalId = selectedPrincipalId.trim();
  if (!principalId) {
    return "";
  }
  return principals.some((principal) => principal.id === principalId) ? principalId : "";
}

export function requireSelectedPrincipalId(
  principals: readonly PrincipalOption[],
  selectedPrincipalId: string
): string | null {
  return normalizePrincipalSelection(principals, selectedPrincipalId) || null;
}
