import mysql from "mysql2/promise"

// Server-only database connector
export class DatabaseConnector {
  private static instance: DatabaseConnector
  private pool: mysql.Pool | null = null

  private constructor() {
    if (typeof window === "undefined") {
      this.initializePool()
    }
  }

  static getInstance(): DatabaseConnector {
    if (!DatabaseConnector.instance) {
      DatabaseConnector.instance = new DatabaseConnector()
    }
    return DatabaseConnector.instance
  }

  private initializePool() {
    if (process.env.DATABASE_URL) {
      this.pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
      })
    }
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    if (!this.pool) {
      throw new Error("Database not initialized")
    }

    try {
      const [results] = await this.pool.execute(sql, params)
      return results
    } catch (error) {
      console.error("Database query error:", error)
      throw error
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end()
    }
  }
}

export const dbConnector = DatabaseConnector.getInstance()
