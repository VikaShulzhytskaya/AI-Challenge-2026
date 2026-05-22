import type { AirportConfig } from "./config.js";
import type {
  AirportStatus,
  BottleneckAnalysis,
  Flight,
  FlightCountsByOperationType,
  FlightCountsByState,
  FlightState,
  SubmitFlightInput
} from "./domain.js";
import { analyzeBottleneck } from "./bottleneck.js";
import { generateScheduleForFlights } from "./scheduler.js";

function createFlightCountsByState(): FlightCountsByState {
  return {
    queued: 0,
    scheduled: 0,
    unscheduled: 0,
    cancelled: 0,
    blocked: 0
  };
}

function createFlightCountsByOperationType(): FlightCountsByOperationType {
  return {
    arrival: 0,
    departure: 0
  };
}

function isUnscheduledState(state: FlightState): boolean {
  return state === "unscheduled" || state === "blocked";
}

export class AirportState {
  readonly config: AirportConfig;
  readonly flights = new Map<string, Flight>();
  readonly gateIds: string[];
  private submissionSequence = 0;

  constructor(config: AirportConfig) {
    this.config = config;
    this.gateIds = Array.from({ length: config.AIRPORT_GATE_COUNT }, (_, index) => `GATE-${index + 1}`);
  }

  nextSubmissionSequence(): number {
    this.submissionSequence += 1;
    return this.submissionSequence;
  }

  listFlights(): Flight[] {
    return [...this.flights.values()].sort((left, right) => left.submittedSequence - right.submittedSequence);
  }

  getFlightQueue() {
    return this.listFlights();
  }

  getRunwayUsage() {
    const scheduledFlights = this.listFlights().filter(
      (flight) => flight.state === "scheduled" && flight.scheduledAssignment
    );

    return this.config.runwayCapabilities.map((runway) => {
      const assignedFlights = scheduledFlights
        .filter((flight) => flight.scheduledAssignment!.runwayId === runway.id)
        .map((flight) => ({
          flightId: flight.id,
          flightNumber: flight.flightNumber,
          operationType: flight.operationType,
          startMinute: flight.scheduledAssignment!.startMinute,
          endMinute: flight.scheduledAssignment!.endMinute
        }));

      return {
        runwayId: runway.id,
        maxLengthMeters: runway.maxLengthMeters,
        scheduledOperationCount: assignedFlights.length,
        assignedFlights
      };
    });
  }

  getTimeline() {
    return this.listFlights()
      .filter((flight) => flight.state === "scheduled" && flight.scheduledAssignment)
      .map((flight) => ({
        flightId: flight.id,
        flightNumber: flight.flightNumber,
        operationType: flight.operationType,
        priority: flight.priority,
        runwayId: flight.scheduledAssignment!.runwayId,
        gateId: flight.scheduledAssignment!.gateId,
        startMinute: flight.scheduledAssignment!.startMinute,
        endMinute: flight.scheduledAssignment!.endMinute
      }))
      .sort((left, right) => left.startMinute - right.startMinute || left.flightId.localeCompare(right.flightId));
  }

  generateSchedule() {
    const nextFlights = generateScheduleForFlights(this.listFlights(), this.config, this.gateIds);
    this.flights.clear();

    for (const flight of nextFlights) {
      this.flights.set(flight.id, flight);
    }

    return {
      flights: this.getFlightQueue(),
      timeline: this.getTimeline(),
      status: this.getStatus()
    };
  }

  getBottleneckAnalysis(): BottleneckAnalysis | null {
    return analyzeBottleneck(this.getFlightQueue());
  }

  submitFlight(input: SubmitFlightInput): Flight {
    const dependencyIds = [...new Set(input.dependencyIds ?? [])];

    for (const dependencyId of dependencyIds) {
      if (!this.flights.has(dependencyId)) {
        throw new Error(`Unknown dependency flight: ${dependencyId}`);
      }
    }

    const flight: Flight = {
      id: `FLIGHT-${String(this.nextSubmissionSequence()).padStart(4, "0")}`,
      flightNumber: input.flightNumber,
      operationType: input.operationType,
      priority: input.priority,
      dependencyIds,
      runwayRequirement: input.runwayRequirement,
      state: "queued",
      submittedSequence: this.submissionSequence
    };

    this.flights.set(flight.id, flight);

    return flight;
  }

  cancelFlight(flightId: string): { cancelledFlight: Flight; affectedFlights: Flight[] } {
    const flight = this.flights.get(flightId);

    if (!flight) {
      throw new Error(`Unknown flight: ${flightId}`);
    }

    const cancelledFlight: Flight = {
      ...flight,
      state: "cancelled",
      scheduledAssignment: undefined,
      unscheduledReason: undefined
    };

    this.flights.set(flightId, cancelledFlight);

    const reverseDependencies = new Map<string, string[]>();
    for (const candidate of this.flights.values()) {
      for (const dependencyId of candidate.dependencyIds) {
        const dependents = reverseDependencies.get(dependencyId) ?? [];
        dependents.push(candidate.id);
        reverseDependencies.set(dependencyId, dependents);
      }
    }

    const affectedFlights: Flight[] = [];
    const queue = [...(reverseDependencies.get(flightId) ?? [])];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const dependentId = queue.shift();
      if (!dependentId || visited.has(dependentId)) {
        continue;
      }

      visited.add(dependentId);
      const dependent = this.flights.get(dependentId);
      if (!dependent || dependent.state === "cancelled") {
        continue;
      }

      const blockedFlight: Flight = {
        ...dependent,
        state: "blocked",
        scheduledAssignment: undefined,
        unscheduledReason: {
          code: "cancelled_dependency",
          detail: `Dependency ${cancelledFlight.flightNumber} has been cancelled.`
        }
      };

      this.flights.set(dependentId, blockedFlight);
      affectedFlights.push(blockedFlight);

      for (const nestedDependentId of reverseDependencies.get(dependentId) ?? []) {
        queue.push(nestedDependentId);
      }
    }

    return {
      cancelledFlight,
      affectedFlights
    };
  }

  getStatus(): AirportStatus {
    const flights = this.listFlights();
    const countsByState = createFlightCountsByState();
    const countsByOperationType = createFlightCountsByOperationType();

    for (const flight of flights) {
      countsByState[flight.state] += 1;
      countsByOperationType[flight.operationType] += 1;
    }

    const scheduledFlights = flights.filter((flight) => flight.state === "scheduled" && flight.scheduledAssignment);
    const usedRunways = new Set(scheduledFlights.map((flight) => flight.scheduledAssignment!.runwayId));
    const usedGates = new Set(scheduledFlights.map((flight) => flight.scheduledAssignment!.gateId));
    const usedGroundCrew = scheduledFlights.length;
    const scheduleCompletionTimeMinutes = scheduledFlights.reduce<number | null>((latest, flight) => {
      const endMinute = flight.scheduledAssignment!.endMinute;
      if (latest === null || endMinute > latest) {
        return endMinute;
      }
      return latest;
    }, null);

    return {
      flightCountsByState: countsByState,
      flightCountsByOperationType: countsByOperationType,
      runwayCapacity: {
        total: this.config.AIRPORT_RUNWAY_COUNT,
        used: usedRunways.size,
        available: Math.max(this.config.AIRPORT_RUNWAY_COUNT - usedRunways.size, 0)
      },
      gateCapacity: {
        total: this.config.AIRPORT_GATE_COUNT,
        used: usedGates.size,
        available: Math.max(this.config.AIRPORT_GATE_COUNT - usedGates.size, 0)
      },
      groundCrewCapacity: {
        total: this.config.AIRPORT_GROUND_CREW_COUNT,
        used: usedGroundCrew,
        available: Math.max(this.config.AIRPORT_GROUND_CREW_COUNT - usedGroundCrew, 0)
      },
      constraintIndicators: {
        runwaysConstrained: usedRunways.size >= this.config.AIRPORT_RUNWAY_COUNT,
        gatesConstrained: usedGates.size >= this.config.AIRPORT_GATE_COUNT,
        groundCrewConstrained: usedGroundCrew >= this.config.AIRPORT_GROUND_CREW_COUNT
      },
      unscheduledFlights: flights
        .filter((flight) => isUnscheduledState(flight.state))
        .map((flight) => ({
          flightId: flight.id,
          flightNumber: flight.flightNumber,
          state: flight.state,
          reason: flight.unscheduledReason ?? null
        })),
      scheduleCompletionTimeMinutes
    };
  }
}