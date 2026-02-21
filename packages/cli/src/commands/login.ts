import { Command } from 'commander';
import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import { getConfig, updateConfig } from '../services/config.service.js';

const API_URL = process.env.USEAI_API_URL || 'https://api.useai.dev';

async function apiCall(endpoint: string, body: Record<string, unknown>): Promise<Record<string, any>> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, any>;

  if (!res.ok) {
    throw new Error(data.message ?? `Request failed (${res.status})`);
  }

  return data;
}

export const loginCommand = new Command('login')
  .description('Login to useai.dev')
  .action(async () => {
    try {
      // Check if already logged in
      const config = getConfig();
      if (config.auth?.token) {
        console.log(chalk.dim(`  Already logged in as ${chalk.bold(config.auth.user.email)}`));
        console.log(chalk.dim('  Run `useai logout` to switch accounts.'));
        return;
      }

      // Step 1: Prompt for email
      const email = await input({
        message: 'Email:',
        validate: (v) => v.includes('@') || 'Please enter a valid email',
      });

      // Step 2: Send OTP
      console.log(chalk.dim('  Sending verification code...'));

      try {
        await apiCall('/api/auth/send-otp', { email });
      } catch (err: any) {
        if (err.message.includes('rate') || err.message.includes('Too many')) {
          console.log(chalk.red('  Too many requests. Please wait a minute and try again.'));
          return;
        }
        throw err;
      }

      console.log(chalk.green('  ✓ Code sent to your email'));
      console.log('');

      // Step 3: Prompt for OTP with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success) {
        const code = await input({
          message: 'Enter 6-digit code (or "resend"):',
          validate: (v) => {
            if (v.toLowerCase() === 'resend') return true;
            return /^\d{6}$/.test(v) || 'Code must be 6 digits (or type "resend")';
          },
        });

        // Handle resend
        if (code.toLowerCase() === 'resend') {
          console.log(chalk.dim('  Resending code...'));
          try {
            await apiCall('/api/auth/send-otp', { email });
            console.log(chalk.green('  ✓ New code sent'));
            console.log('');
            continue;
          } catch (err: any) {
            if (err.message.includes('rate') || err.message.includes('Too many')) {
              console.log(chalk.yellow('  Please wait before requesting a new code.'));
              continue;
            }
            throw err;
          }
        }

        // Step 4: Verify OTP
        try {
          const result = await apiCall('/api/auth/verify-otp', { email, code });

          if (result?.token) {
            updateConfig({
              auth: {
                token: result.token,
                user: {
                  id: result.user.id,
                  email: result.user.email,
                  username: result.user.username,
                },
              },
            });

            console.log('');
            console.log(chalk.green(`  ✓ Logged in as ${chalk.bold(result.user.email)}`));
            if (result.user.username) {
              console.log(chalk.dim(`    username: ${result.user.username}`));
            }
            console.log('');
            console.log(chalk.dim('  Your sessions and milestones will sync to useai.dev'));
            success = true;
          }
        } catch (err: any) {
          attempts++;

          if (err.message.includes('expired') || err.message.includes('No valid OTP')) {
            console.log(chalk.red('  Code expired. Sending a new one...'));
            await apiCall('/api/auth/send-otp', { email });
            console.log(chalk.green('  ✓ New code sent'));
            attempts = 0;
            continue;
          }

          if (err.message.includes('Too many attempts')) {
            console.log(chalk.red('  Too many attempts. Sending a new code...'));
            await apiCall('/api/auth/send-otp', { email });
            console.log(chalk.green('  ✓ New code sent'));
            attempts = 0;
            continue;
          }

          const remaining = maxAttempts - attempts;
          if (remaining > 0) {
            console.log(chalk.red(`  Invalid code. ${remaining} attempt(s) remaining.`));
          } else {
            console.log(chalk.red('  Too many invalid attempts. Please try again later.'));
            return;
          }
        }
      }

      if (!success) {
        console.log(chalk.red('  Login failed. Please try again.'));
      }
    } catch (err: any) {
      // Handle Ctrl+C gracefully
      if (err.name === 'ExitPromptError' || err.message?.includes('force closed')) {
        console.log('');
        console.log(chalk.dim('  Cancelled.'));
        return;
      }
      console.log(chalk.red(`  Login failed: ${err.message}`));
    }
  });

export const logoutCommand = new Command('logout')
  .description('Logout from useai.dev')
  .action(() => {
    const config = getConfig();
    if (!config.auth) {
      console.log(chalk.dim('  Not logged in.'));
      return;
    }

    const email = config.auth.user.email;
    updateConfig({ auth: undefined } as any);
    console.log(chalk.green(`  ✓ Logged out from ${email}`));
  });
