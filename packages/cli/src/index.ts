#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION } from '@useai/shared/constants';
import { statsCommand } from './commands/stats.js';
import { statusCommand } from './commands/status.js';
import { milestonesCommand } from './commands/milestones.js';
import { configCommand } from './commands/config.js';
import { exportCommand } from './commands/export.js';
import { purgeCommand } from './commands/purge.js';
import { mcpCommand } from './commands/setup.js';
import { daemonCommand } from './commands/daemon.js';
import { serveCommand } from './commands/serve.js';
import { loginCommand, logoutCommand } from './commands/login.js';
import { updateCommand } from './commands/update.js';

const program = new Command();

program
  .name('useai')
  .description('useai.dev — Track your AI-assisted development workflow')
  .version(VERSION);

program.addCommand(statsCommand);
program.addCommand(statusCommand);
program.addCommand(milestonesCommand);
program.addCommand(configCommand);
program.addCommand(exportCommand);
program.addCommand(purgeCommand);
program.addCommand(mcpCommand);
program.addCommand(daemonCommand);
program.addCommand(serveCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(updateCommand);

program.parse();
