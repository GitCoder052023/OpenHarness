import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import type { OpenHarnessApiClient } from "./client/openharness-api-client.js";
import {
  OPENHARNESS_EXECUTE_TOOL_NAME,
  OPENHARNESS_EXECUTE_TOOL_DESCRIPTION,
  OPENHARNESS_EXECUTE_TOOL_SCHEMA,
  executeToolHandler,
} from "./tools/execute-tool.js";

export interface CreateMcpServerOptions {
  apiClient: OpenHarnessApiClient;
  serverInfo?: {
    name: string;
    version: string;
  };
}

export function createMcpServer(options: CreateMcpServerOptions): Server {
  const server = new Server(
    options.serverInfo || {
      name: "openharness",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: OPENHARNESS_EXECUTE_TOOL_NAME,
          description: OPENHARNESS_EXECUTE_TOOL_DESCRIPTION,
          inputSchema: OPENHARNESS_EXECUTE_TOOL_SCHEMA,
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    if (name !== OPENHARNESS_EXECUTE_TOOL_NAME) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: '${name}'. Available tools: ${OPENHARNESS_EXECUTE_TOOL_NAME}`
      );
    }

    return executeToolHandler(options.apiClient, rawArgs);
  });

  return server;
}
