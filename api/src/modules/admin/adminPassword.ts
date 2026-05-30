import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const keyLength = 64;
const defaultCost = { N: 16384, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, keylen: number, options: typeof defaultCost): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, keyLength, defaultCost);

  return [
    "scrypt",
    String(defaultCost.N),
    String(defaultCost.r),
    String(defaultCost.p),
    salt.toString("base64url"),
    key.toString("base64url")
  ].join("$");
}

export async function verifyAdminPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts[0] !== "scrypt") {
    return timingSafeStringEqual(password, storedHash);
  }

  if (parts.length !== 6) {
    return false;
  }

  const [, nValue, rValue, pValue, saltValue, keyValue] = parts;
  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  const salt = Buffer.from(saltValue, "base64url");
  const expected = Buffer.from(keyValue, "base64url");
  const actual = await scrypt(password, salt, expected.length, { N, r, p });
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
