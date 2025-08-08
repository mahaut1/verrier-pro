import { defineConfig } from "drizzle-kit";

// Configuration spécifique pour PostgreSQL Docker local
const dockerDatabaseUrl = "postgresql://postgres:admin123@localhost:5432/verrierpro";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dockerDatabaseUrl,
  },
});