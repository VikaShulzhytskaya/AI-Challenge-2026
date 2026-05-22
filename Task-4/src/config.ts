import { z } from "zod";

const envSchema = z.object({
  AIRPORT_RUNWAY_COUNT: z.coerce.number().int().positive(),
  AIRPORT_GATE_COUNT: z.coerce.number().int().positive(),
  AIRPORT_GROUND_CREW_COUNT: z.coerce.number().int().positive(),
  AIRPORT_TAKEOFF_SEPARATION_MINUTES: z.coerce.number().int().nonnegative(),
  AIRPORT_LANDING_SEPARATION_MINUTES: z.coerce.number().int().nonnegative(),
  AIRPORT_MIXED_SEPARATION_MINUTES: z.coerce.number().int().nonnegative(),
  AIRPORT_GATE_TURNAROUND_MINUTES: z.coerce.number().int().nonnegative(),
  AIRPORT_DEPENDENCY_BUFFER_MINUTES: z.coerce.number().int().nonnegative(),
  AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES: z.coerce.number().int().positive(),
  AIRPORT_ARRIVAL_DURATION_MINUTES: z.coerce.number().int().positive(),
  AIRPORT_DEPARTURE_DURATION_MINUTES: z.coerce.number().int().positive(),
  AIRPORT_RUNWAY_CAPABILITIES_JSON: z.string().min(2)
});

const runwaySchema = z.object({
  id: z.string().min(1),
  maxLengthMeters: z.number().positive()
});

export type AirportConfig = z.infer<typeof envSchema> & {
  runwayCapabilities: Array<z.infer<typeof runwaySchema>>;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AirportConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid airport configuration: ${details}`);
  }

  let runwayCapabilities: Array<z.infer<typeof runwaySchema>>;

  try {
    const raw = JSON.parse(parsed.data.AIRPORT_RUNWAY_CAPABILITIES_JSON);
    runwayCapabilities = z.array(runwaySchema).parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parsing error";
    throw new Error(`Invalid AIRPORT_RUNWAY_CAPABILITIES_JSON: ${message}`);
  }

  if (runwayCapabilities.length !== parsed.data.AIRPORT_RUNWAY_COUNT) {
    throw new Error(
      "Invalid airport configuration: AIRPORT_RUNWAY_CAPABILITIES_JSON length must match AIRPORT_RUNWAY_COUNT"
    );
  }

  return {
    ...parsed.data,
    runwayCapabilities
  };
}