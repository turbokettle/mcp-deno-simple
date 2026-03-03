#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { runDenoScript } from './runDeno';

// Expand --allow-read-cwd / --allow-write-cwd into --allow-read=<cwd> / --allow-write=<cwd>
function expandCwdPermissions(args: string[]): string[] {
  const cwd = process.cwd();
  return args.map((arg) => {
    if (arg === '--allow-read-cwd') return `--allow-read=${cwd}`;
    if (arg === '--allow-write-cwd') return `--allow-write=${cwd}`;
    return arg;
  });
}

// Get the permissions from the command line arguments
const permissionArgs = expandCwdPermissions(process.argv.slice(2));

// Create an MCP server using the higher-level McpServer class
const server = new McpServer({
  name: 'DenoSandbox',
  version: '1.0.0',
});

const permissionsText =
  permissionArgs.length > 0
    ? `Current Deno Permissions:\n${permissionArgs.join('\n')}`
    : 'No permissions currently enabled.';

// Add a resource for Deno permissions
server.resource('deno-permissions', 'permissions://deno', async (uri) => {
  return {
    contents: [
      {
        uri: uri.href,
        text: `${permissionsText}

Deno supports the following permissions (can be configured by the user before the session is started):
--allow-read[=<PATH>...] or -R[=<PATH>...]
--deny-read[=<PATH>...]
--allow-write[=<PATH>...] or -W[=<PATH>...]
--deny-write[=<PATH>...]
--allow-net[=<IP_OR_HOSTNAME>...] or -N[=<IP_OR_HOSTNAME>...]
--deny-net[=<IP_OR_HOSTNAME>...]
--allow-imports[=<HOSTNAME>...]
--allow-env[=<VARIABLE_NAME>...] or -E[=<VARIABLE_NAME>...]
--deny-env[=<VARIABLE_NAME>...]`,
      },
    ],
  };
});

const toolDescription = permissionArgs.length > 0
  ? `Executes TypeScript/JavaScript code. Returns stdout - use console.log(...) or a temporary file to see results. Current Deno permissions: ${permissionArgs.join('; ')}`
  : 'Executes TypeScript/JavaScript code in a sandboxed, safe, restricted environment. Returns stdout - use console.log(...) or a temporary file to see results.';

// Add runTypescript tool
server.tool(
  'runTypescript',
  toolDescription,
  {
    code: z.string().describe('Code to execute in the Deno sandbox'),
  },
  async ({ code }) => {
    try {
      const output = await runDenoScript(code, permissionArgs);
      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start the server with stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
  console.error(`Unhandled Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
