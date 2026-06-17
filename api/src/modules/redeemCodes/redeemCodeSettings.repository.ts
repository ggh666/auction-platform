import { parseRedeemCodeText, type RedeemCodeConfigResponse } from "@auction/shared";

export type RedeemCodeSettingsRepository = {
  read(): Promise<RedeemCodeConfigResponse>;
  update(rawText: string, updatedBy: number): Promise<RedeemCodeConfigResponse>;
};

function responseFromState(state: { rawText: string; updatedBy: number | null; updatedAt: string | null }): RedeemCodeConfigResponse {
  return {
    rawText: state.rawText,
    items: parseRedeemCodeText(state.rawText),
    updatedBy: state.updatedBy,
    updatedAt: state.updatedAt
  };
}

export function createInMemoryRedeemCodeSettingsRepository(
  options: { now?: () => Date } = {}
): RedeemCodeSettingsRepository {
  const now = options.now ?? (() => new Date());
  let state = { rawText: "", updatedBy: null as number | null, updatedAt: null as string | null };

  return {
    async read() {
      return responseFromState(state);
    },

    async update(rawText, updatedBy) {
      const nextState = {
        rawText,
        updatedBy,
        updatedAt: now().toISOString()
      };
      const response = responseFromState(nextState);
      state = nextState;
      return response;
    }
  };
}
