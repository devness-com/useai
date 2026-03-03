import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
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
        console.log(pc.dim(`  Already logged in as ${pc.bold(config.auth.user.email)}`));
        console.log(pc.dim('  Run `useai logout` to switch accounts.'));
        return;
      }

      // Step 1: Prompt for email
      const emailResult = await p.text({
        message: 'Email:',
        validate: (v) => !v || !v.includes('@') ? 'Please enter a valid email' : undefined,
      });
      if (p.isCancel(emailResult)) {
        console.log(pc.dim('\n  Cancelled.'));
        return;
      }
      const email = emailResult;

      // Step 2: Send OTP
      console.log(pc.dim('  Sending verification code...'));

      try {
        await apiCall('/api/auth/send-otp', { email });
      } catch (err: any) {
        if (err.message.includes('rate') || err.message.includes('Too many')) {
          console.log(pc.red('  Too many requests. Please wait a minute and try again.'));
          return;
        }
        throw err;
      }

      console.log(pc.green('  ✓ Code sent to your email'));
      console.log('');

      // Step 3: Prompt for OTP with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success) {
        const codeResult = await p.text({
          message: 'Enter 6-digit code (or "resend"):',
          validate: (v) => {
            if (!v) return 'Code is required';
            if (v.toLowerCase() === 'resend') return undefined;
            return /^\d{6}$/.test(v) ? undefined : 'Code must be 6 digits (or type "resend")';
          },
        });
        if (p.isCancel(codeResult)) {
          console.log(pc.dim('\n  Cancelled.'));
          return;
        }
        const code = codeResult;

        // Handle resend
        if (code.toLowerCase() === 'resend') {
          console.log(pc.dim('  Resending code...'));
          try {
            await apiCall('/api/auth/send-otp', { email });
            console.log(pc.green('  ✓ New code sent'));
            console.log('');
            continue;
          } catch (err: any) {
            if (err.message.includes('rate') || err.message.includes('Too many')) {
              console.log(pc.yellow('  Please wait before requesting a new code.'));
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
            console.log(pc.green(`  ✓ Logged in as ${pc.bold(result.user.email)}`));
            if (result.user.username) {
              console.log(pc.dim(`    username: ${result.user.username}`));
            }
            console.log('');
            console.log(pc.dim('  Your sessions and milestones will sync to useai.dev'));
            success = true;
          }
        } catch (err: any) {
          attempts++;

          if (err.message.includes('expired') || err.message.includes('No valid OTP')) {
            console.log(pc.red('  Code expired. Sending a new one...'));
            await apiCall('/api/auth/send-otp', { email });
            console.log(pc.green('  ✓ New code sent'));
            attempts = 0;
            continue;
          }

          if (err.message.includes('Too many attempts')) {
            console.log(pc.red('  Too many attempts. Sending a new code...'));
            await apiCall('/api/auth/send-otp', { email });
            console.log(pc.green('  ✓ New code sent'));
            attempts = 0;
            continue;
          }

          const remaining = maxAttempts - attempts;
          if (remaining > 0) {
            console.log(pc.red(`  Invalid code. ${remaining} attempt(s) remaining.`));
          } else {
            console.log(pc.red('  Too many invalid attempts. Please try again later.'));
            return;
          }
        }
      }

      if (!success) {
        console.log(pc.red('  Login failed. Please try again.'));
      }
    } catch (err: any) {
      // Handle Ctrl+C gracefully
      if (err.name === 'ExitPromptError' || err.message?.includes('force closed')) {
        console.log('');
        console.log(pc.dim('  Cancelled.'));
        return;
      }
      console.log(pc.red(`  Login failed: ${err.message}`));
    }
  });

export const logoutCommand = new Command('logout')
  .description('Logout from useai.dev')
  .action(() => {
    const config = getConfig();
    if (!config.auth) {
      console.log(pc.dim('  Not logged in.'));
      return;
    }

    const email = config.auth.user.email;
    updateConfig({ auth: undefined } as any);
    console.log(pc.green(`  ✓ Logged out from ${email}`));
  });
