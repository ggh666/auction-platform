import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { AdminRole } from "@auction/shared";
import { createPool } from "../db/pool";
import { hashAdminPassword } from "../modules/admin/adminPassword";

function parseRole(value: string | undefined): AdminRole {
  if (value === "super_admin" || value === "reviewer" || value === "operator") {
    return value;
  }

  throw new Error("Role must be one of: super_admin, reviewer, operator");
}

async function readPassword(cliPassword: string | undefined): Promise<string> {
  if (cliPassword?.trim()) {
    return cliPassword;
  }
  if (process.env.ADMIN_PASSWORD?.trim()) {
    return process.env.ADMIN_PASSWORD;
  }

  const rl = createInterface({ input, output });
  try {
    const password = await rl.question("Admin password: ");
    if (!password.trim()) {
      throw new Error("Admin password cannot be empty");
    }
    return password;
  } finally {
    rl.close();
  }
}

const { values } = parseArgs({
  options: {
    username: { type: "string" },
    role: { type: "string", default: "super_admin" },
    password: { type: "string" }
  }
});

if (!values.username?.trim()) {
  throw new Error("Usage: npm run admin:create --workspace @auction/api -- --username <name> --role <role>");
}

const role = parseRole(values.role);
const password = await readPassword(values.password);
const passwordHash = await hashAdminPassword(password);
const pool = createPool();

try {
  await pool.execute(
    `INSERT INTO admin_users (username, password_hash, role)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       role = VALUES(role),
       disabled_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [values.username.trim(), passwordHash, role]
  );
  output.write(`Admin user ${values.username.trim()} saved with role ${role}\n`);
} finally {
  await pool.end();
}
