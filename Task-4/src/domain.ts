export const operationTypes = ["arrival", "departure"] as const;
export type OperationType = (typeof operationTypes)[number];

export const priorityLevels = ["high", "medium", "low"] as const;
export type PriorityLevel = (typeof priorityLevels)[number];

export const flightStates = ["queued", "scheduled", "unscheduled", "cancelled", "blocked"] as const;
export type FlightState = (typeof flightStates)[number];

export const unscheduledReasonCodes = [
  "dependency_not_ready",
  "dependency_cycle",
  "no_suitable_runway",
  "runway_capacity_exceeded",
  "gate_capacity_exceeded",
  "ground_crew_unavailable",
  "scheduling_horizon_exceeded",
  "cancelled_dependency",
  "manual_hold"
] as const;
export type UnscheduledReasonCode = (typeof unscheduledReasonCodes)[number];

export interface FlightRunwayRequirement {
  minLengthMeters?: number | undefined;
}

export interface UnscheduledReason {
  code: UnscheduledReasonCode;
  detail: string;
}

export interface ScheduleAssignment {
  runwayId: string;
  gateId: string;
  startMinute: number;
  endMinute: number;
}

export interface Flight {
  id: string;
  flightNumber: string;
  operationType: OperationType;
  priority: PriorityLevel;
  dependencyIds: string[];
  runwayRequirement?: FlightRunwayRequirement | undefined;
  state: FlightState;
  scheduledAssignment?: ScheduleAssignment | undefined;
  unscheduledReason?: UnscheduledReason | undefined;
  submittedSequence: number;
}

export interface SubmitFlightInput {
  flightNumber: string;
  operationType: OperationType;
  priority: PriorityLevel;
  dependencyIds?: string[] | undefined;
  runwayRequirement?: FlightRunwayRequirement | undefined;
}

export interface FlightCountsByState {
  queued: number;
  scheduled: number;
  unscheduled: number;
  cancelled: number;
  blocked: number;
}

export interface FlightCountsByOperationType {
  arrival: number;
  departure: number;
}

export interface AirportStatus {
  flightCountsByState: FlightCountsByState;
  flightCountsByOperationType: FlightCountsByOperationType;
  runwayCapacity: {
    total: number;
    used: number;
    available: number;
  };
  gateCapacity: {
    total: number;
    used: number;
    available: number;
  };
  groundCrewCapacity: {
    total: number;
    used: number;
    available: number;
  };
  constraintIndicators: {
    runwaysConstrained: boolean;
    gatesConstrained: boolean;
    groundCrewConstrained: boolean;
  };
  unscheduledFlights: Array<{
    flightId: string;
    flightNumber: string;
    state: FlightState;
    reason: UnscheduledReason | null;
  }>;
  scheduleCompletionTimeMinutes: number | null;
}

export interface BottleneckAnalysis {
  chain: Array<{
    flightId: string;
    flightNumber: string;
    startMinute: number;
    endMinute: number;
  }>;
  elapsedMinutes: number;
}