import { describe, expect, it } from "vitest";
import {
  dragonBallPriceReferenceProfessionOptions,
  dragonBallProfessionOptions,
  isDragonBallPriceReferenceProfession,
  isDragonBallProfession
} from "./dragonBall";

describe("dragon ball options", () => {
  it("does not expose warlord as a dragon ball profession", () => {
    expect(dragonBallProfessionOptions).not.toContain("战将");
    expect(isDragonBallProfession("战将")).toBe(false);
    expect(dragonBallPriceReferenceProfessionOptions).not.toContain("战将");
    expect(isDragonBallPriceReferenceProfession("战将")).toBe(false);
  });
});
