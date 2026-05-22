import "dotenv/config";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { loadConfig } from "./config.js";
import { AirportState } from "./state.js";

const config = loadConfig();
const airportState = new AirportState(config);

const server = new McpServer({
  name: "air-traffic-control-mcp",
  version: "0.1.0"
});

const submitFlightSchema = {
  flightNumber: z.string().min(1),
  operationType: z.enum(["arrival", "departure"]),
  priority: z.enum(["high", "medium", "low"]),
  dependencyIds: z.array(z.string().min(1)).optional(),
  runwayRequirement: z
    .object({
      minLengthMeters: z.number().positive().optional()
    })
    .optional()
};

const cancelFlightSchema = {
  flightId: z.string().min(1)
};

const generateScheduleSchema = {};
const bottleneckSchema = {};

server.registerResource(
  "flight-queue",
  "airport://flight-queue",
  {
    title: "Flight Queue",
    description: "The current flight queue, including queued, unscheduled, scheduled, and cancelled flights.",
    mimeType: "application/json"
  },
  async () => ({
    contents: [
      {
        uri: "airport://flight-queue",
        text: JSON.stringify(airportState.getFlightQueue(), null, 2)
      }
    ]
  })
);

server.registerResource(
  "runway-usage",
  "airport://runways",
  {
    title: "Runway Usage",
    description: "The current runway availability and assigned operations.",
    mimeType: "application/json"
  },
  async () => ({
    contents: [
      {
        uri: "airport://runways",
        text: JSON.stringify(airportState.getRunwayUsage(), null, 2)
      }
    ]
  })
);

server.registerResource(
  "operation-timeline",
  "airport://timeline",
  {
    title: "Operation Timeline",
    description: "The chronological schedule of airport operations.",
    mimeType: "application/json"
  },
  async () => ({
    contents: [
      {
        uri: "airport://timeline",
        text: JSON.stringify(airportState.getTimeline(), null, 2)
      }
    ]
  })
);

server.registerTool(
  "submit_flight",
  {
    title: "Submit Flight",
    description: "Adds a new arrival or departure to the airport flight queue.",
    inputSchema: submitFlightSchema
  },
  async (input) => {
    const flight = airportState.submitFlight(input);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Flight submitted.",
              flight
            },
            null,
            2
          )
        }
      ]
    };
  }
);

server.registerTool(
  "cancel_flight",
  {
    title: "Cancel Flight",
    description: "Marks a queued or scheduled flight as cancelled.",
    inputSchema: cancelFlightSchema
  },
  async ({ flightId }) => {
    const result = airportState.cancelFlight(flightId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Flight cancelled.",
              ...result
            },
            null,
            2
          )
        }
      ]
    };
  }
);

server.registerTool(
  "generate_schedule",
  {
    title: "Generate Schedule",
    description: "Replaces the current schedule with a freshly computed schedule based on the current queue and airport configuration.",
    inputSchema: generateScheduleSchema
  },
  async () => {
    const result = airportState.generateSchedule();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              message: "Schedule generated.",
              ...result
            },
            null,
            2
          )
        }
      ]
    };
  }
);

server.registerTool(
  "analyze_bottleneck",
  {
    title: "Analyze Bottleneck",
    description: "Identifies the longest active scheduled dependency chain in the current airport schedule.",
    inputSchema: bottleneckSchema
  },
  async () => {
    const bottleneck = airportState.getBottleneckAnalysis();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              bottleneck
            },
            null,
            2
          )
        }
      ]
    };
  }
);

server.registerTool(
  "airport_status",
  {
    title: "Airport Status",
    description: "Returns the current airport status derived from the in-memory airport state.",
    inputSchema: {}
  },
  async () => {
    const status = airportState.getStatus();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "state-ready",
              ...status
            },
            null,
            2
          )
        }
      ]
    };
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});