import type { BottleneckAnalysis, Flight } from "./domain.js";

interface ChainState {
  chain: Flight[];
  startMinute: number;
  elapsedMinutes: number;
}

function compareChains(left: ChainState, right: ChainState): number {
  return (
    right.elapsedMinutes - left.elapsedMinutes ||
    left.startMinute - right.startMinute ||
    left.chain.length - right.chain.length ||
    left.chain.map((flight) => flight.id).join("|").localeCompare(right.chain.map((flight) => flight.id).join("|"))
  );
}

export function analyzeBottleneck(flights: Flight[]): BottleneckAnalysis | null {
  const scheduledFlights = flights
    .filter((flight) => flight.state === "scheduled" && flight.scheduledAssignment)
    .sort(
      (left, right) =>
        left.scheduledAssignment!.startMinute - right.scheduledAssignment!.startMinute ||
        left.submittedSequence - right.submittedSequence
    );

  const scheduledById = new Map(scheduledFlights.map((flight) => [flight.id, flight]));
  const bestChainByFlightId = new Map<string, ChainState>();
  let bestChain: ChainState | null = null;

  for (const flight of scheduledFlights) {
    const assignment = flight.scheduledAssignment!;
    let currentBest: ChainState = {
      chain: [flight],
      startMinute: assignment.startMinute,
      elapsedMinutes: assignment.endMinute - assignment.startMinute
    };

    for (const dependencyId of flight.dependencyIds) {
      if (!scheduledById.has(dependencyId)) {
        continue;
      }

      const dependencyChain = bestChainByFlightId.get(dependencyId);
      if (!dependencyChain) {
        continue;
      }

      const candidate: ChainState = {
        chain: [...dependencyChain.chain, flight],
        startMinute: dependencyChain.startMinute,
        elapsedMinutes: assignment.endMinute - dependencyChain.startMinute
      };

      if (compareChains(candidate, currentBest) < 0) {
        currentBest = candidate;
      }
    }

    bestChainByFlightId.set(flight.id, currentBest);

    if (currentBest.chain.length > 1 && (!bestChain || compareChains(currentBest, bestChain) < 0)) {
      bestChain = currentBest;
    }
  }

  if (!bestChain) {
    return null;
  }

  return {
    chain: bestChain.chain.map((flight) => ({
      flightId: flight.id,
      flightNumber: flight.flightNumber,
      startMinute: flight.scheduledAssignment!.startMinute,
      endMinute: flight.scheduledAssignment!.endMinute
    })),
    elapsedMinutes: bestChain.elapsedMinutes
  };
}