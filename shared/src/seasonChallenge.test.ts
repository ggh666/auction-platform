import { describe, expect, it } from "vitest";
import {
  calculateSeasonChallenge,
  defaultSeasonChallengeProgress,
  seasonChallengeSections,
  toggleSeasonChallengeStep
} from "./seasonChallenge";

describe("season challenge calculator", () => {
  it("matches the xiguaApp default selected challenge progress", () => {
    const result = calculateSeasonChallenge();

    expect(result.totalPoints).toBe(500);
    expect(result.medals).toBe(30);
    expect(result.sectionPoints).toMatchObject({
      winStreak: 0,
      proficiency: 0,
      iceCastle: 0,
      heroLevel: 0,
      bigNav: 100,
      cooperation: 100,
      maxCups: 200,
      loginDays: 100,
      recharge: 0
    });
  });

  it("exposes all xiguaApp challenge sections and point ladders", () => {
    expect(seasonChallengeSections.map((section) => section.id)).toEqual([
      "winStreak",
      "proficiency",
      "iceCastle",
      "heroLevel",
      "bigNav",
      "cooperation",
      "maxCups",
      "loginDays",
      "recharge"
    ]);
    expect(seasonChallengeSections.find((section) => section.id === "winStreak")?.steps).toEqual([
      { value: "2", label: "2连胜", points: 20 },
      { value: "4", label: "4连胜", points: 20 },
      { value: "6", label: "6连胜", points: 40 },
      { value: "8", label: "8连胜", points: 40 },
      { value: "10", label: "10连胜", points: 80 }
    ]);
    expect(seasonChallengeSections.find((section) => section.id === "recharge")?.steps.at(-1)).toEqual({
      value: "8888",
      label: "8888元",
      points: 1000
    });
  });

  it("calculates medals at every threshold cumulatively", () => {
    expect(calculateSeasonChallenge({ winStreak: ["2", "4", "6", "8", "10"] }).medals).toBe(0);
    expect(calculateSeasonChallenge({ recharge: ["98", "198", "648", "1288"] }).medals).toBe(10);
    expect(calculateSeasonChallenge({ recharge: ["98", "198", "648", "1288", "1888"] }).medals).toBe(70);
    expect(calculateSeasonChallenge({ recharge: ["98", "198", "648", "1288", "1888", "3888"] }).medals).toBe(140);
    expect(calculateSeasonChallenge({ recharge: ["98", "198", "648", "1288", "1888", "3888", "8888"] }).medals).toBe(240);
  });

  it("toggles ladder steps with xiguaApp cascading selection behavior", () => {
    const first = toggleSeasonChallengeStep(defaultSeasonChallengeProgress, "winStreak", "6");

    expect(first.winStreak).toEqual(["2", "4", "6"]);
    expect(calculateSeasonChallenge(first).sectionPoints.winStreak).toBe(80);

    const second = toggleSeasonChallengeStep(first, "winStreak", "4");

    expect(second.winStreak).toEqual(["2"]);
    expect(calculateSeasonChallenge(second).sectionPoints.winStreak).toBe(20);

    const third = toggleSeasonChallengeStep(second, "winStreak", "2");

    expect(third.winStreak).toEqual([]);
    expect(calculateSeasonChallenge(third).sectionPoints.winStreak).toBe(0);
  });

  it("falls back safely for invalid or unknown progress values", () => {
    const result = calculateSeasonChallenge({
      bad: ["999"],
      winStreak: ["bad", "10", "2"],
      recharge: "bad"
    } as never);

    expect(result.progress.winStreak).toEqual(["2", "10"]);
    expect(result.sectionPoints.winStreak).toBe(100);
    expect(result.sectionPoints.recharge).toBe(0);
    expect(Number.isNaN(result.totalPoints)).toBe(false);
    expect(Number.isNaN(result.medals)).toBe(false);

    const unchanged = toggleSeasonChallengeStep(defaultSeasonChallengeProgress, "bad" as never, "2");
    expect(unchanged).toEqual(defaultSeasonChallengeProgress);
  });
});
