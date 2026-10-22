import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/shell.go (POST shell/exec) - synchronous, non-interactive
// `bash -lc` run in the account's container as the account user, returning
// exit code + capped stdout/stderr. Same privilege ceiling as ECP's own
// browser terminal; what differs is that an AI drives it and can be steered
// by content it reads (prompt injection). So every command is shown to the
// human through MCP elicitation and runs only on an explicit accept - not a
// `confirm: true` argument, which the model itself fills in. A client that
// can't show elicitation prompts can't use this tool at all (fails closed).

export const shellTools: ToolDef[] = [
  {
    name: "ecp_shell_exec",
    description:
      "Run one shell command (bash -lc) in this hosting account's container as the account user and return its exit code, stdout and stderr. " +
      "The user is asked to approve every command before it runs; if they decline, nothing runs. " +
      "Non-interactive: no TTY and no stdin, so anything that prompts (sudo, interactive installers, `read`) fails immediately instead of waiting. " +
      "timeout_seconds defaults to 60, max 300 - the whole process tree is killed at the timeout, so don't use this to start long-running servers (use ecp_apps_deploy_step start or ecp_supervisor_* instead). " +
      "stdout/stderr are each capped at 512 KB (see *_truncated). cwd defaults to the account's home directory; a relative cwd is resolved against it. " +
      "Prefer a dedicated tool when one exists (files, databases, git pull, asdf, supervisor) - they're safer and give structured results.",
    inputSchema: {
      command: z.string().min(1),
      cwd: z.string().optional(),
      timeout_seconds: z.number().int().positive().max(300).optional(),
    },
    handler: async (args, client, ctx) => {
      const where = args.cwd ? `in ${args.cwd}` : "in the home directory";
      const approved = await ctx.askUser(`Run this shell command on the hosting account (${where})?\n\n${args.command}`);
      if (!approved) {
        throw new Error("The user declined to run this command. Nothing was executed.");
      }
      return client.request("POST", "shell/exec", {
        body: { command: args.command, cwd: args.cwd, timeout_seconds: args.timeout_seconds },
      });
    },
  },
];
