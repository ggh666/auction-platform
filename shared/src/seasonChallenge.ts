export const seasonChallengeSections = [
  {
    id: "winStreak",
    title: "连胜",
    description: "赛季对战连胜目标",
    steps: [
      { value: "2", label: "2连胜", points: 20 },
      { value: "4", label: "4连胜", points: 20 },
      { value: "6", label: "6连胜", points: 40 },
      { value: "8", label: "8连胜", points: 40 },
      { value: "10", label: "10连胜", points: 80 }
    ]
  },
  {
    id: "proficiency",
    title: "熟练度",
    description: "英雄熟练度段位目标",
    steps: [
      { value: "silver", label: "银", points: 20 },
      { value: "gold", label: "金", points: 40 },
      { value: "platinum", label: "铂金", points: 60 },
      { value: "diamond", label: "钻石", points: 100 },
      { value: "star", label: "星", points: 160 }
    ]
  },
  {
    id: "iceCastle",
    title: "寒冰堡",
    description: "寒冰堡通关层数目标",
    steps: [
      { value: "60", label: "60关", points: 20 },
      { value: "80", label: "80关", points: 20 },
      { value: "100", label: "100关", points: 40 },
      { value: "120", label: "120关", points: 40 },
      { value: "140", label: "140关", points: 80 }
    ]
  },
  {
    id: "heroLevel",
    title: "英雄等级",
    description: "赛季英雄等级目标",
    steps: [
      { value: "3", label: "3级", points: 40 },
      { value: "6", label: "6级", points: 80 },
      { value: "9", label: "9级", points: 120 },
      { value: "12", label: "12级", points: 160 },
      { value: "15", label: "15级", points: 200 }
    ]
  },
  {
    id: "bigNav",
    title: "大航海",
    description: "大航海通关目标",
    steps: [
      { value: "150", label: "150关", points: 10 },
      { value: "300", label: "300关", points: 10 },
      { value: "600", label: "600关", points: 20 },
      { value: "900", label: "900关", points: 20 },
      { value: "1500", label: "1500关", points: 40 }
    ]
  },
  {
    id: "cooperation",
    title: "合作",
    description: "合作模式通关目标",
    steps: [
      { value: "2000", label: "2000关", points: 10 },
      { value: "4000", label: "4000关", points: 10 },
      { value: "8000", label: "8000关", points: 20 },
      { value: "12000", label: "12000关", points: 20 },
      { value: "18000", label: "18000关", points: 40 }
    ]
  },
  {
    id: "maxCups",
    title: "最高杯",
    description: "赛季最高杯数目标",
    steps: [
      { value: "5000", label: "5000杯", points: 20 },
      { value: "10000", label: "10000杯", points: 20 },
      { value: "15000", label: "15000杯", points: 40 },
      { value: "20000", label: "20000杯", points: 40 },
      { value: "30000", label: "30000杯", points: 80 }
    ]
  },
  {
    id: "loginDays",
    title: "登录天数",
    description: "赛季累计登录天数",
    steps: [
      { value: "3", label: "3天", points: 10 },
      { value: "5", label: "5天", points: 10 },
      { value: "7", label: "7天", points: 20 },
      { value: "10", label: "10天", points: 20 },
      { value: "14", label: "14天", points: 40 }
    ]
  },
  {
    id: "recharge",
    title: "充值",
    description: "赛季累计充值目标",
    steps: [
      { value: "98", label: "98元", points: 30 },
      { value: "198", label: "198元", points: 60 },
      { value: "648", label: "648元", points: 100 },
      { value: "1288", label: "1288元", points: 300 },
      { value: "1888", label: "1888元", points: 500 },
      { value: "3888", label: "3888元", points: 800 },
      { value: "8888", label: "8888元", points: 1000 }
    ]
  }
] as const;

export type SeasonChallengeSection = (typeof seasonChallengeSections)[number];
export type SeasonChallengeSectionId = SeasonChallengeSection["id"];
export type SeasonChallengeStep = SeasonChallengeSection["steps"][number];
export type SeasonChallengeProgress = Record<SeasonChallengeSectionId, string[]>;

export type SeasonChallengeResult = {
  progress: SeasonChallengeProgress;
  sectionPoints: Record<SeasonChallengeSectionId, number>;
  totalPoints: number;
  medals: number;
};

const medalThresholds = [
  { points: 300, medals: 10 },
  { points: 500, medals: 20 },
  { points: 800, medals: 40 },
  { points: 1000, medals: 70 },
  { points: 2000, medals: 100 }
] as const;

const emptySeasonChallengeProgress: SeasonChallengeProgress = {
  winStreak: [],
  proficiency: [],
  iceCastle: [],
  heroLevel: [],
  bigNav: [],
  cooperation: [],
  maxCups: [],
  loginDays: [],
  recharge: []
};

export const defaultSeasonChallengeProgress: SeasonChallengeProgress = {
  ...emptySeasonChallengeProgress,
  bigNav: ["150", "300", "600", "900", "1500"],
  cooperation: ["2000", "4000", "8000", "12000", "18000"],
  maxCups: ["5000", "10000", "15000", "20000", "30000"],
  loginDays: ["3", "5", "7", "10", "14"]
};

export function calculateSeasonChallenge(
  progress?: Partial<Record<SeasonChallengeSectionId, unknown>>
): SeasonChallengeResult {
  const normalized = normalizeSeasonChallengeProgress(
    progress === undefined ? defaultSeasonChallengeProgress : progress
  );
  const sectionPoints = seasonChallengeSections.reduce(
    (accumulator, section) => {
      const selected = new Set(normalized[section.id]);
      accumulator[section.id] = section.steps.reduce(
        (sum, step) => sum + (selected.has(step.value) ? step.points : 0),
        0
      );
      return accumulator;
    },
    { ...emptySeasonChallengeProgress } as unknown as Record<SeasonChallengeSectionId, number>
  );
  const totalPoints = Object.values(sectionPoints).reduce((sum, points) => sum + points, 0);

  return {
    progress: normalized,
    sectionPoints,
    totalPoints,
    medals: calculateMedals(totalPoints)
  };
}

export function toggleSeasonChallengeStep(
  progress: Partial<Record<SeasonChallengeSectionId, unknown>>,
  sectionId: SeasonChallengeSectionId,
  stepValue: string
): SeasonChallengeProgress {
  const normalized = normalizeSeasonChallengeProgress(progress);
  const section = seasonChallengeSections.find((item) => item.id === sectionId);
  if (!section) {
    return normalized;
  }

  const stepIndex = section.steps.findIndex((step) => step.value === stepValue);
  if (stepIndex < 0) {
    return normalized;
  }

  const selected = new Set(normalized[sectionId]);
  const shouldSelectTarget = !selected.has(stepValue);
  return {
    ...normalized,
    [sectionId]: section.steps
      .slice(0, shouldSelectTarget ? stepIndex + 1 : stepIndex)
      .map((step) => step.value)
  };
}

export function normalizeSeasonChallengeProgress(
  progress: Partial<Record<SeasonChallengeSectionId, unknown>>
): SeasonChallengeProgress {
  return seasonChallengeSections.reduce((accumulator, section) => {
    const rawValues = progress[section.id];
    const inputValues = Array.isArray(rawValues) ? rawValues : [];
    const selected = new Set(inputValues.map((item) => String(item)));
    accumulator[section.id] = section.steps
      .map((step) => step.value)
      .filter((value) => selected.has(value));
    return accumulator;
  }, { ...emptySeasonChallengeProgress });
}

function calculateMedals(totalPoints: number): number {
  return medalThresholds.reduce(
    (sum, threshold) => sum + (totalPoints >= threshold.points ? threshold.medals : 0),
    0
  );
}
