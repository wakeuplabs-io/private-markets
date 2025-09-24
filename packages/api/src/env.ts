import { config } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { z } from "zod";

expand(
  config({
    path: path.resolve(process.cwd(), process.env.NODE_ENV === "test" ? ".env.test" : ".env"),
  }),
);

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(9999),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Blockchain Configuration
  PREDICTION_MARKET_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  RPC_URL: z.string().url("Invalid RPC URL"),
  CHAIN_ID: z.coerce.number().int().positive("Chain ID must be positive"),
  START_BLOCK: z.coerce.number().int().min(0, "Start block must be non-negative").default(0),
});

export type env = z.infer<typeof EnvSchema>;

const { data: env, error } = EnvSchema.safeParse(process.env);

if (error) {
  console.error("❌ Invalid env:");
  console.error(JSON.stringify(error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export default env!;
