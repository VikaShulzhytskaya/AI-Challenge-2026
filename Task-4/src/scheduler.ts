import type { AirportConfig } from "./config.js";
import type { Flight, OperationType, ScheduleAssignment, UnscheduledReason } from "./domain.js";

const priorityOrder = {
  high: 0,
  medium: 1,
  low: 2
} as const;

function getOperationDurationMinutes(flight: Flight, config: AirportConfig): number {
  return flight.operationType === "arrival"
    ? config.AIRPORT_ARRIVAL_DURATION_MINUTES
    : config.AIRPORT_DEPARTURE_DURATION_MINUTES;
}

function getRunwaySeparationMinutes(
  previousOperation: OperationType,
  nextOperation: OperationType,
  config: AirportConfig
): number {
  if (previousOperation === "departure" && nextOperation === "departure") {
    return config.AIRPORT_TAKEOFF_SEPARATION_MINUTES;
  }

  if (previousOperation === "arrival" && nextOperation === "arrival") {
    return config.AIRPORT_LANDING_SEPARATION_MINUTES;
  }

  return config.AIRPORT_MIXED_SEPARATION_MINUTES;
}

function cloneForScheduling(flight: Flight): Flight {
  if (flight.state === "cancelled") {
    return { ...flight, scheduledAssignment: undefined };
  }

  return {
    ...flight,
    state: "queued",
    scheduledAssignment: undefined,
    unscheduledReason: undefined
  };
}

function buildCancelledDependencySet(flightsById: Map<string, Flight>): Set<string> {
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();

  function hasCancelledDependency(flightId: string): boolean {
    const cached = memo.get(flightId);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(flightId)) {
      return false;
    }

    visiting.add(flightId);

    const flight = flightsById.get(flightId);
    if (!flight) {
      visiting.delete(flightId);
      memo.set(flightId, false);
      return false;
    }

    const result = flight.dependencyIds.some((dependencyId) => {
      const dependency = flightsById.get(dependencyId);
      if (!dependency) {
        return false;
      }

      if (dependency.state === "cancelled") {
        return true;
      }

      return hasCancelledDependency(dependencyId);
    });

    visiting.delete(flightId);
    memo.set(flightId, result);
    return result;
  }

  const blocked = new Set<string>();

  for (const flight of flightsById.values()) {
    if (flight.state !== "cancelled" && hasCancelledDependency(flight.id)) {
      blocked.add(flight.id);
    }
  }

  return blocked;
}

function buildDependencyCycleSet(flights: Flight[]): Set<string> {
  const eligibleIds = new Set(flights.map((flight) => flight.id));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const flight of flights) {
    const dependencies = flight.dependencyIds.filter((dependencyId) => eligibleIds.has(dependencyId));
    indegree.set(flight.id, dependencies.length);

    for (const dependencyId of dependencies) {
      const dependencyDependents = dependents.get(dependencyId) ?? [];
      dependencyDependents.push(flight.id);
      dependents.set(dependencyId, dependencyDependents);
    }
  }

  const queue = flights
    .filter((flight) => (indegree.get(flight.id) ?? 0) === 0)
    .sort(
      (left, right) =>
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        left.submittedSequence - right.submittedSequence ||
        left.flightNumber.localeCompare(right.flightNumber)
    )
    .map((flight) => flight.id);

  const processed = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }

    processed.add(currentId);

    for (const dependentId of dependents.get(currentId) ?? []) {
      const nextIndegree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(dependentId);
        queue.sort((leftId, rightId) => {
          const left = flights.find((flight) => flight.id === leftId)!;
          const right = flights.find((flight) => flight.id === rightId)!;
          return (
            priorityOrder[left.priority] - priorityOrder[right.priority] ||
            left.submittedSequence - right.submittedSequence ||
            left.flightNumber.localeCompare(right.flightNumber)
          );
        });
      }
    }
  }

  return new Set(flights.filter((flight) => !processed.has(flight.id)).map((flight) => flight.id));
}

function sortForScheduling(flights: Flight[]): Flight[] {
  const flightsById = new Map(flights.map((flight) => [flight.id, flight]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const flight of flights) {
    const dependencies = flight.dependencyIds.filter((dependencyId) => flightsById.has(dependencyId));
    indegree.set(flight.id, dependencies.length);
    for (const dependencyId of dependencies) {
      const dependencyDependents = dependents.get(dependencyId) ?? [];
      dependencyDependents.push(flight.id);
      dependents.set(dependencyId, dependencyDependents);
    }
  }

  const ready = flights
    .filter((flight) => (indegree.get(flight.id) ?? 0) === 0)
    .sort(
      (left, right) =>
        priorityOrder[left.priority] - priorityOrder[right.priority] ||
        left.submittedSequence - right.submittedSequence ||
        left.flightNumber.localeCompare(right.flightNumber)
    );

  const ordered: Flight[] = [];

  while (ready.length > 0) {
    const current = ready.shift();
    if (!current) {
      continue;
    }

    ordered.push(current);

    for (const dependentId of dependents.get(current.id) ?? []) {
      const nextIndegree = (indegree.get(dependentId) ?? 0) - 1;
      indegree.set(dependentId, nextIndegree);
      if (nextIndegree === 0) {
        ready.push(flightsById.get(dependentId)!);
        ready.sort(
          (left, right) =>
            priorityOrder[left.priority] - priorityOrder[right.priority] ||
            left.submittedSequence - right.submittedSequence ||
            left.flightNumber.localeCompare(right.flightNumber)
        );
      }
    }
  }

  return ordered;
}

function overlaps(startMinute: number, endMinute: number, otherStartMinute: number, otherEndMinute: number): boolean {
  return startMinute < otherEndMinute && otherStartMinute < endMinute;
}

function isGroundCrewAvailable(
  scheduledFlights: Flight[],
  startMinute: number,
  endMinute: number,
  config: AirportConfig
): boolean {
  let concurrentFlights = 0;

  for (const flight of scheduledFlights) {
    const assignment = flight.scheduledAssignment;
    if (!assignment) {
      continue;
    }

    if (overlaps(startMinute, endMinute, assignment.startMinute, assignment.endMinute)) {
      concurrentFlights += 1;
    }
  }

  return concurrentFlights < config.AIRPORT_GROUND_CREW_COUNT;
}

function isGateAvailable(
  scheduledFlights: Flight[],
  gateId: string,
  startMinute: number,
  endMinute: number,
  config: AirportConfig
): boolean {
  return scheduledFlights.every((flight) => {
    const assignment = flight.scheduledAssignment;
    if (!assignment || assignment.gateId !== gateId) {
      return true;
    }

    return !overlaps(
      startMinute,
      endMinute + config.AIRPORT_GATE_TURNAROUND_MINUTES,
      assignment.startMinute,
      assignment.endMinute + config.AIRPORT_GATE_TURNAROUND_MINUTES
    );
  });
}

function isRunwayAvailable(
  scheduledFlights: Flight[],
  runwayId: string,
  flight: Flight,
  startMinute: number,
  endMinute: number,
  config: AirportConfig
): boolean {
  return scheduledFlights.every((scheduledFlight) => {
    const assignment = scheduledFlight.scheduledAssignment;
    if (!assignment || assignment.runwayId !== runwayId) {
      return true;
    }

    const separationBefore = getRunwaySeparationMinutes(
      scheduledFlight.operationType,
      flight.operationType,
      config
    );
    const separationAfter = getRunwaySeparationMinutes(flight.operationType, scheduledFlight.operationType, config);

    return (
      endMinute + separationAfter <= assignment.startMinute ||
      startMinute >= assignment.endMinute + separationBefore
    );
  });
}

function createReason(code: UnscheduledReason["code"], detail: string): UnscheduledReason {
  return { code, detail };
}

function findAssignment(
  flight: Flight,
  scheduledFlights: Flight[],
  gateIds: string[],
  config: AirportConfig,
  earliestStartMinute: number
): { assignment: ScheduleAssignment | null; reason: UnscheduledReason } {
  const suitableRunways = config.runwayCapabilities
    .filter((runway) => runway.maxLengthMeters >= (flight.runwayRequirement?.minLengthMeters ?? 0))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (suitableRunways.length === 0) {
    return {
      assignment: null,
      reason: createReason("no_suitable_runway", "No runway satisfies the flight runway requirement.")
    };
  }

  const durationMinutes = getOperationDurationMinutes(flight, config);
  const latestStartMinute = config.AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES - durationMinutes;

  if (earliestStartMinute > latestStartMinute) {
    return {
      assignment: null,
      reason: createReason("scheduling_horizon_exceeded", "No start time remains within the scheduling horizon.")
    };
  }

  let runwayWindowFound = false;
  let gateWindowFound = false;
  let crewWindowFound = false;

  for (let startMinute = Math.max(0, earliestStartMinute); startMinute <= latestStartMinute; startMinute += 1) {
    const endMinute = startMinute + durationMinutes;
    const crewAvailable = isGroundCrewAvailable(scheduledFlights, startMinute, endMinute, config);

    for (const runway of suitableRunways) {
      if (!isRunwayAvailable(scheduledFlights, runway.id, flight, startMinute, endMinute, config)) {
        continue;
      }

      runwayWindowFound = true;

      for (const gateId of gateIds) {
        if (!isGateAvailable(scheduledFlights, gateId, startMinute, endMinute, config)) {
          continue;
        }

        gateWindowFound = true;

        if (!crewAvailable) {
          continue;
        }

        crewWindowFound = true;
        return {
          assignment: {
            runwayId: runway.id,
            gateId,
            startMinute,
            endMinute
          },
          reason: createReason("scheduling_horizon_exceeded", "Scheduled successfully.")
        };
      }
    }
  }

  if (!runwayWindowFound) {
    return {
      assignment: null,
      reason: createReason("runway_capacity_exceeded", "No runway slot is available within the scheduling horizon.")
    };
  }

  if (!gateWindowFound) {
    return {
      assignment: null,
      reason: createReason("gate_capacity_exceeded", "No gate slot is available within the scheduling horizon.")
    };
  }

  if (!crewWindowFound) {
    return {
      assignment: null,
      reason: createReason("ground_crew_unavailable", "Ground crew capacity is exhausted within the scheduling horizon.")
    };
  }

  return {
    assignment: null,
    reason: createReason("scheduling_horizon_exceeded", "No feasible assignment was found within the scheduling horizon.")
  };
}

export function generateScheduleForFlights(
  flights: Flight[],
  config: AirportConfig,
  gateIds: string[]
): Flight[] {
  const scheduledFlights = flights.map(cloneForScheduling);
  const flightsById = new Map(scheduledFlights.map((flight) => [flight.id, flight]));

  const cancelledDependencySet = buildCancelledDependencySet(flightsById);
  for (const flightId of cancelledDependencySet) {
    const flight = flightsById.get(flightId);
    if (!flight) {
      continue;
    }

    flight.state = "blocked";
    flight.unscheduledReason = createReason(
      "cancelled_dependency",
      "At least one dependency has been cancelled."
    );
  }

  const eligibleFlights = scheduledFlights.filter(
    (flight) => flight.state !== "cancelled" && !cancelledDependencySet.has(flight.id)
  );
  const dependencyCycleSet = buildDependencyCycleSet(eligibleFlights);

  for (const flightId of dependencyCycleSet) {
    const flight = flightsById.get(flightId);
    if (!flight) {
      continue;
    }

    flight.state = "blocked";
    flight.unscheduledReason = createReason("dependency_cycle", "The flight participates in a dependency cycle.");
  }

  const schedulingOrder = sortForScheduling(
    eligibleFlights.filter((flight) => !dependencyCycleSet.has(flight.id))
  );

  for (const flight of schedulingOrder) {
    const mutableFlight = flightsById.get(flight.id);
    if (!mutableFlight || mutableFlight.state === "cancelled") {
      continue;
    }

    let earliestStartMinute = 0;
    let dependencyBlockedReason: UnscheduledReason | null = null;

    for (const dependencyId of mutableFlight.dependencyIds) {
      const dependency = flightsById.get(dependencyId);
      if (!dependency) {
        continue;
      }

      if (dependency.state === "cancelled") {
        dependencyBlockedReason = createReason(
          "cancelled_dependency",
          `Dependency ${dependency.flightNumber} has been cancelled.`
        );
        break;
      }

      if (dependency.state !== "scheduled" || !dependency.scheduledAssignment) {
        dependencyBlockedReason = createReason(
          "dependency_not_ready",
          `Dependency ${dependency.flightNumber} was not scheduled successfully.`
        );
        break;
      }

      earliestStartMinute = Math.max(
        earliestStartMinute,
        dependency.scheduledAssignment.endMinute + config.AIRPORT_DEPENDENCY_BUFFER_MINUTES
      );
    }

    if (dependencyBlockedReason) {
      mutableFlight.state = "blocked";
      mutableFlight.unscheduledReason = dependencyBlockedReason;
      continue;
    }

    const alreadyScheduled = scheduledFlights.filter(
      (candidate) => candidate.id !== mutableFlight.id && candidate.state === "scheduled" && candidate.scheduledAssignment
    );
    const { assignment, reason } = findAssignment(
      mutableFlight,
      alreadyScheduled,
      gateIds,
      config,
      earliestStartMinute
    );

    if (!assignment) {
      mutableFlight.state = "unscheduled";
      mutableFlight.unscheduledReason = reason;
      continue;
    }

    mutableFlight.state = "scheduled";
    mutableFlight.scheduledAssignment = assignment;
    mutableFlight.unscheduledReason = undefined;
  }

  return scheduledFlights;
}