import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../../../lib/db/src/schema/index.ts";
export * from "../../../lib/db/src/schema/index.ts";

// Never import the application DB client. Every connection has a private search
// path without public fallback; fixtures cannot read or mutate student tables.
const schemaName = `bridge_test_${randomUUID().replaceAll("-", "")}`;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${schemaName}`,
  max: 12,
});
export const db = drizzle(pool, { schema });

export async function setupDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for API regression tests");
  await pool.query(`CREATE SCHEMA "${schemaName}"`);
  // Generate DDL from the actual schema, including course_id's legacy default.
  // Rewrite explicit public FK references into the isolated namespace.
  const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema));
  for (const statement of statements) {
    await pool.query(statement.replaceAll('"public".', `"${schemaName}".`));
  }
}

export async function teardownDatabase() {
  try {
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await pool.end();
  }
}

// Hold one already-read resource snapshot so a DELETE can deterministically
// lose to a reply, without sleeps or changes to the production route.
export async function holdResourceSnapshot(run) {
  const original = pool.query;
  let reached, release, held = false;
  const ready = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  pool.query = async function (...args) {
    const result = await original.apply(this, args);
    const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
    if (!held && /^select .* from "bridge_resources" where /i.test(text ?? "") && result.rows.length === 1) {
      held = true;
      reached();
      await gate;
    }
    return result;
  };
  try { return await run({ ready, release }); }
  finally { release(); pool.query = original; }
}

// Force competing submissions to read the same unsubmitted assessment before
// any UPDATE is sent. This makes loss of the atomic WHERE result IS NULL guard
// reliably observable rather than depending on HTTP scheduling luck.
export async function raceSubmissions(count, run) {
  const original = pool.query;
  let waiting = 0;
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  const timer = setTimeout(() => release(), 5000);
  pool.query = async function (...args) {
    const result = await original.apply(this, args);
    const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
    if (/^select .* from "bridge_assessments" where /i.test(text ?? "") &&
        result.rows.length === 1 && waiting < count) {
      waiting++;
      if (waiting === count) release();
      await ready;
    }
    return result;
  };
  try {
    const result = await run();
    if (waiting !== count) throw new Error(`Race barrier reached by ${waiting}/${count} submissions`);
    return result;
  } finally {
    clearTimeout(timer);
    pool.query = original;
  }
}
