# Implementation Report

## Scheduling approach

The server uses an in-memory airport state model plus a deterministic greedy scheduler. Each `generate_schedule` call discards previous non-cancelled assignments and recomputes the schedule from the current queue and active configuration.

The scheduling flow is:

1. Reset all non-cancelled flights to an unscheduled working state.
2. Mark flights blocked by cancelled dependencies.
3. Detect dependency cycles and block those flights.
4. Topologically order the remaining flights using priority and submission-order tie-breakers.
5. For each ready flight, search minute-by-minute for the earliest feasible runway, gate, and crew slot.
6. Keep flights that cannot be scheduled in the queue with structured reasons.

## Key decisions

- TypeScript + MCP SDK: chosen for direct MCP server support and structured tool/resource registration.
- In-memory state: sufficient for the task and simpler to reason about than persistence.
- Deterministic greedy scheduling: easier to verify, debug, and document than a global optimization approach.
- Explicit runway capability config: added because the heavy-hauler scenario requires runway suitability checks.
- Explicit operation durations: added because schedule completion and bottleneck duration need concrete timing.

## Tools and techniques used

- `@modelcontextprotocol/sdk` for MCP stdio server implementation.
- `zod` for startup environment validation.
- A pure scheduler module for keeping scheduling logic separate from MCP transport wiring.

## What worked

- The pure scheduler plus in-memory state split kept the MCP layer thin.
- The deterministic ordering made scheduling behavior stable and repeatable.
- Representing blocked and unscheduled flights explicitly made status and resources more informative.

## What did not

- The current scheduler is greedy, not globally optimal. It finds the earliest feasible placement, not the best overall airport throughput.
- Dependency-cycle handling is conservative: flights entangled in unresolved dependency cycles are blocked rather than partially salvaged.
- Ground crew usage is modeled as one crew per active operation window, not a richer task-by-task ground workflow.