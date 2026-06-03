import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const contractsPath = resolve(import.meta.dirname, "api-contracts.ts");
const domainPath = resolve(import.meta.dirname, "domain.ts");

describe("deal followup shared contracts", () => {
  it("does not expose buyer contact collection contracts", () => {
    const contracts = readFileSync(contractsPath, "utf8");
    const domain = readFileSync(domainPath, "utf8");

    expect(contracts).not.toContain("DealFollowupContactRequest");
    expect(contracts).not.toContain("DealFollowupContactResponse");
    expect(contracts).not.toContain("buyerContactStatus");
    expect(contracts).not.toContain("buyerContact");
    expect(domain).not.toContain("deal_contact_required");
  });
});
