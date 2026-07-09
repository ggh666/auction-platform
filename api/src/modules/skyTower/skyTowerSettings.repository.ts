import {
  mergeSkyTowerFloorOverrides,
  parseSkyTowerConfigText,
  skyTowerRewards,
  type SkyTowerConfigResponse
} from "@auction/shared";

export type SkyTowerSettingsRepository = {
  read(): Promise<SkyTowerConfigResponse>;
  update(rawText: string, updatedBy: number): Promise<SkyTowerConfigResponse>;
};

function responseFromState(state: { rawText: string; updatedBy: number | null; updatedAt: string | null }): SkyTowerConfigResponse {
  const items = parseSkyTowerConfigText(state.rawText);
  return {
    rawText: state.rawText,
    items,
    floors: mergeSkyTowerFloorOverrides(items),
    rewards: [...skyTowerRewards],
    updatedBy: state.updatedBy,
    updatedAt: state.updatedAt
  };
}

export function createInMemorySkyTowerSettingsRepository(
  options: { now?: () => Date } = {}
): SkyTowerSettingsRepository {
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
