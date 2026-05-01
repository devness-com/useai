import { getConfig, saveConfig, patchConfig, getDaemonUrl } from "@devness/useai-storage";
import { sendOtp, verifyOtp, checkUsername, claimUsername } from "@devness/useai-cloud";

export async function login(email: string, code: string) {
  const auth = await verifyOtp(email, code);
  await patchConfig({ auth: { token: auth.token, user: { id: auth.user.id, email: auth.user.email, username: auth.user.username } }, sync: { autoSync: true, intervalMinutes: 30, leaderboardStats: true, evaluationReasons: "none" } });
  return auth;
}

export { sendOtp, checkUsername, claimUsername };

export async function logout(): Promise<void> {
  const daemonUrl = await getDaemonUrl();
  await fetch(`${daemonUrl}/api/local/auth/logout`, {
    method: "POST",
  }).catch(() => {});
  // Also clear config directly in case daemon is not running
  const config = await getConfig();
  config.auth = {} as typeof config.auth;
  await saveConfig(config);
}

export async function getAuthToken(): Promise<string | null> {
  const config = await getConfig();
  return config.auth.token ?? null;
}
