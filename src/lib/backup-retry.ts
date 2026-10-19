// Storage occasionally exhausts its connection pool during a large archive walk.
// Retry only transient failures; permission/path errors must remain visible.
export async function retryBackupRead<T>(
  operation: () => Promise<T>,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= 3 || !/too many connections|connection.*(timeout|reset)|temporarily unavailable/i.test(message)) {
        throw error;
      }
      await pause(1000 * 2 ** attempt);
    }
  }
}