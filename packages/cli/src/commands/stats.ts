import { Command } from 'commander';
import chalk from 'chalk';
import { formatDuration } from '@useai/shared/utils';
import { getStats } from '../services/stats.service.js';
import { header, table, info } from '../utils/display.js';

export const statsCommand = new Command('stats')
  .description('Show aggregated AI development stats')
  .action(() => {
    const stats = getStats();

    if (stats.totalSessions === 0) {
      console.log(info('No sessions recorded yet.'));
      return;
    }

    console.log(header('AI Development Stats'));

    console.log(
      table([
        ['Total time', chalk.bold(formatDuration(Math.round(stats.totalHours * 3600)))],
        ['Sessions', chalk.bold(String(stats.totalSessions))],
        ['Current streak', chalk.bold(`${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`)],
      ]),
    );

    const clientEntries = Object.entries(stats.byClient).sort((a, b) => b[1] - a[1]);
    if (clientEntries.length > 0) {
      console.log(header('By Client'));
      console.log(
        table(clientEntries.map(([name, secs]) => [name, formatDuration(secs)])),
      );
    }

    const langEntries = Object.entries(stats.byLanguage).sort((a, b) => b[1] - a[1]);
    if (langEntries.length > 0) {
      console.log(header('By Language'));
      console.log(
        table(langEntries.map(([name, secs]) => [name, formatDuration(secs)])),
      );
    }

    const taskEntries = Object.entries(stats.byTaskType).sort((a, b) => b[1] - a[1]);
    if (taskEntries.length > 0) {
      console.log(header('By Task Type'));
      console.log(
        table(taskEntries.map(([name, secs]) => [name, formatDuration(secs)])),
      );
    }

    console.log('');
  });
