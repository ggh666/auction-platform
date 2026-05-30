import type { MysqlConnection, MysqlPool } from "./mysqlTypes";

export async function inTransaction<T>(pool: MysqlPool, fn: (connection: MysqlConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
