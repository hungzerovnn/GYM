import { neon } from "@neondatabase/serverless";

export type WorkerEnv = {
  NEON_DATABASE_URL?: string;
};

export type DbStatusResult = {
  connected: true;
  database: string;
  user: string;
  now: string;
};

export const checkNeonConnection = async (
  connectionString: string,
): Promise<DbStatusResult> => {
  const sql = neon(connectionString);
  const rows = await sql`SELECT current_database() as database, current_user as user, now() as now`;
  const first = rows[0] as { database: string; user: string; now: string };
  return {
    connected: true,
    database: first.database,
    user: first.user,
    now: first.now,
  };
};
