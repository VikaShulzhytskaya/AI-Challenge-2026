# Air Traffic Control MCP Server

This project implements an AI-ready airport operations server using the Model Context Protocol (MCP). The server accepts flight submissions, generates deterministic airport schedules, exposes airport state through MCP tools and resources, propagates dependency cancellations, and analyzes the longest scheduled dependency bottleneck.

## Install

1. Use Node.js 20 or newer.
2. Install dependencies:

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and adjust values as needed.

```bash
cp .env.example .env
```

### Environment variables

- `AIRPORT_RUNWAY_COUNT`: positive integer. Must match the number of runway entries in `AIRPORT_RUNWAY_CAPABILITIES_JSON`.
- `AIRPORT_GATE_COUNT`: positive integer.
- `AIRPORT_GROUND_CREW_COUNT`: positive integer.
- `AIRPORT_TAKEOFF_SEPARATION_MINUTES`: non-negative integer.
- `AIRPORT_LANDING_SEPARATION_MINUTES`: non-negative integer.
- `AIRPORT_MIXED_SEPARATION_MINUTES`: non-negative integer.
- `AIRPORT_GATE_TURNAROUND_MINUTES`: non-negative integer.
- `AIRPORT_DEPENDENCY_BUFFER_MINUTES`: non-negative integer.
- `AIRPORT_MAX_SCHEDULING_HORIZON_MINUTES`: positive integer.
- `AIRPORT_ARRIVAL_DURATION_MINUTES`: positive integer.
- `AIRPORT_DEPARTURE_DURATION_MINUTES`: positive integer.
- `AIRPORT_RUNWAY_CAPABILITIES_JSON`: JSON array of runway objects. Each object must contain:

```json
[
	{ "id": "RWY-1", "maxLengthMeters": 3600 },
	{ "id": "RWY-2", "maxLengthMeters": 2800 }
]
```

Invalid or inconsistent configuration fails at startup with a clear error message.

## Build and run

Start the server in development mode:

```bash
npm run dev
```

Build the server:

```bash
npm run build
```

Run the built server:

```bash
npm run start
```

## Connect from an MCP-compatible client

This repository includes [mcp.json](.vscode/mcp.json) for local VS Code MCP testing. It launches the server over stdio with:

```json
{
	"servers": {
		"air-traffic-control": {
			"type": "stdio",
			"command": "npx",
			"args": ["tsx", "src/index.ts"]
		}
	}
}
```

Any MCP-compatible client can use the same stdio entrypoint.

## Exposed tools

- `submit_flight`: adds a new arrival or departure to the queue. Inputs: `flightNumber`, `operationType`, `priority`, optional `dependencyIds`, optional `runwayRequirement.minLengthMeters`.
- `generate_schedule`: clears and recomputes the current schedule from the current queue and environment configuration.
- `airport_status`: returns structured airport status including flight counts, resource capacity/usage, constraint indicators, unscheduled or blocked flights, and schedule completion time.
- `cancel_flight`: marks a flight as cancelled and immediately blocks dependent flights affected by that cancellation.
- `analyze_bottleneck`: returns the longest currently scheduled dependency chain and its elapsed duration.

## Exposed resources

- `airport://flight-queue`: the full current queue, including queued, scheduled, unscheduled, blocked, and cancelled flights.
- `airport://runways`: runway capability and assigned operation data.
- `airport://timeline`: chronological scheduled operations timeline.

## Scheduling behavior

- The scheduler is deterministic for the same queue and configuration.
- Flights are considered in dependency-aware priority order: high, then medium, then low, with stable submission-order tie-breaking.
- Scheduling assigns the earliest feasible runway, gate, and start time that satisfies runway suitability, runway separation buffers, gate turnaround, ground crew capacity, dependency buffer, and scheduling horizon limits.
- Flights that cannot be placed remain visible with explicit reasons.