/**
 * Check for newer versions of a package on npm.
 */

const PACKAGE_NAME = '@devness/useai';

export async function fetchLatestVersion(packageName: string = PACKAGE_NAME): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}
