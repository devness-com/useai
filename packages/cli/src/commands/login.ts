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

async function apiGet(endpoint: string, token: string): Promise<Record<string, any>> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json() as Record<string, any>;

  if (!res.ok) {
    throw new Error(data.message ?? `Request failed (${res.status})`);
  }

  return data;
}

async function apiPatch(endpoint: string, token: string, body: Record<string, unknown>): Promise<Record<string, any>> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as Record<string, any>;

  if (!res.ok) {
    throw new Error(data.message ?? `Request failed (${res.status})`);
  }

  return data;
}

function validateUsernameFormat(username: string): string | undefined {
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be at most 20 characters';
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(username) && username.length >= 3) {
    return 'Only lowercase letters, numbers, and hyphens (not at start/end)';
  }
  if (/--/.test(username)) return 'No consecutive hyphens';
  return undefined;
}

async function claimUsername(token: string): Promise<string | undefined> {
  // Loop until the user picks a valid, available username
  while (true) {
    const usernameResult = await p.text({
      message: 'Choose a username:',
      placeholder: 'e.g. fastdev',
      validate: (v) => {
        if (!v) return 'Username is required';
        return validateUsernameFormat(v);
      },
    });
    if (p.isCancel(usernameResult)) {
      return undefined;
    }
    const username = usernameResult.toLowerCase();

    // Check availability
    try {
      const check = await apiGet(`/api/users/check-username/${encodeURIComponent(username)}`, token);
      if (!check.available) {
        console.log(pc.yellow(`  "${username}" is not available${check.reason ? `: ${check.reason}` : ''}. Try another.`));
        continue;
      }
    } catch {
      console.log(pc.yellow('  Could not verify availability. Try again.'));
      continue;
    }

    // Claim it
    try {
      await apiPatch('/api/users/me', token, { username });
      return username;
    } catch (err: any) {
      console.log(pc.yellow(`  Could not claim "${username}": ${err.message}. Try another.`));
      continue;
    }
  }
}

export const loginCommand = new Command('login')
  .description('Login to useai.dev and enable Cloud Mode')
  .action(async () => {
    try {
      // Check if already logged in
      const config = getConfig();
      if (config.auth?.token) {
        const mode = pc.green('Cloud Mode');
        const user = config.auth.user.username
          ? `@${config.auth.user.username}`
          : config.auth.user.email;
        console.log(pc.dim(`  Already logged in as ${pc.bold(user)} (${mode})`));
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
      let verifyResult: Record<string, any> | null = null;

      while (attempts < maxAttempts && !verifyResult) {
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
            verifyResult = result;
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

      if (!verifyResult) {
        console.log(pc.red('  Login failed. Please try again.'));
        return;
      }

      // Step 5: Username claiming (required for new users)
      let username: string | undefined = verifyResult.user.username;

      if (!username) {
        console.log('');
        console.log(pc.green(`  ✓ Authenticated as ${pc.bold(email)}`));
        console.log('');

        username = await claimUsername(verifyResult.token);
        if (!username) {
          // User cancelled username selection — abort login entirely
          console.log(pc.dim('\n  Login cancelled — username is required for Cloud Mode.'));
          return;
        }
        console.log(pc.green(`  ✓ Username claimed: @${username}`));
      }

      // Step 6: Save config — enable Cloud Mode (auth + sync)
      updateConfig({
        auth: {
          token: verifyResult.token,
          user: {
            id: verifyResult.user.id,
            email: verifyResult.user.email,
            username,
          },
        },
        sync: { enabled: true, interval_hours: config.sync.interval_hours },
      });

      console.log('');
      console.log(pc.green(`  ✓ Cloud Mode enabled`));
      console.log(pc.dim(`    Logged in as ${pc.bold(`@${username}`)} (${email})`));
      console.log(pc.dim(`    Sessions sync hourly — prompts stay local`));
      console.log(pc.dim(`    Profile: useai.dev/@${username}`));
      console.log('');
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
  .description('Logout and return to Local Mode')
  .action(() => {
    const config = getConfig();
    if (!config.auth) {
      console.log(pc.dim('  Not logged in — already in Local Mode.'));
      return;
    }

    const email = config.auth.user.email;
    updateConfig({
      auth: undefined,
      sync: { enabled: false, interval_hours: config.sync.interval_hours },
    } as any);
    console.log(pc.green(`  ✓ Logged out from ${email}`));
    console.log(pc.dim('  Local Mode — your data stays on this device.'));
  });
