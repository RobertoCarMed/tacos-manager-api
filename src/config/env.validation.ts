export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  if (config['NODE_ENV'] === 'test') return config;

  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((key) => !config[key]);

  if (missing.length > 0) {
    const env = config['NODE_ENV'] || 'development';
    throw new Error(
      `[Config] Missing required environment variables: ${missing.join(', ')}\n` +
        `  → Ensure .env.${env} (or .env) is present and defines all required variables.`,
    );
  }

  return config;
}
