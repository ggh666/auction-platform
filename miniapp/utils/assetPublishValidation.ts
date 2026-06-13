export type UserAssetBaseFields = {
  gameName: string;
  serverName: string;
  title: string;
  description: string;
};

export type DragonBallPublishFields = {
  profession: string;
  quality: string;
  attributes: string;
};

const userAssetBaseFieldLabels: Array<[keyof UserAssetBaseFields, string]> = [
  ["gameName", "游戏"],
  ["serverName", "区服"],
  ["title", "标题"],
  ["description", "描述"]
];

const dragonBallFieldLabels: Array<[keyof DragonBallPublishFields, string]> = [
  ["profession", "职业"],
  ["quality", "品质"],
  ["attributes", "属性"]
];

function missingLabels<T extends Record<string, string>>(fields: T, labels: Array<[keyof T, string]>): string[] {
  return labels.filter(([key]) => !fields[key].trim()).map(([, label]) => label);
}

export function missingUserAssetBaseFieldMessage(fields: UserAssetBaseFields): string {
  const labels = missingLabels(fields, userAssetBaseFieldLabels);
  return labels.length > 0 ? `请填写${labels.join("、")}` : "";
}

export function missingDragonBallFieldMessage(fields: DragonBallPublishFields): string {
  const labels = missingLabels(fields, dragonBallFieldLabels);
  return labels.length > 0 ? `请填写龙珠${labels.join("、")}` : "";
}
