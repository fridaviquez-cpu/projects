import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";

// Additive rollout only: existing counters are never reset.
const day = new Date().toISOString().slice(0, 10);
try {
  await db.execute(sql`
    INSERT INTO bridge_generation_usage (visitor_id, day, count)
    SELECT visitor_id, ${day}, count(*)::integer
    FROM bridge_resources WHERE created_at >= ${`${day}T00:00:00Z`}::timestamptz
    GROUP BY visitor_id
    ON CONFLICT (visitor_id) DO NOTHING
  `);
} finally {
  await pool.end();
}
