type MetaEnvironment = Record<string, string | undefined>;

export class MetaTokenManagerError extends Error {
  constructor(
    message: string,
    readonly errorCode = 'meta_token_manager_failed',
    readonly statusCode = 503
  ) {
    super(message);
    this.name = 'MetaTokenManagerError';
  }
}

/** Read the Meta token from server-only environment configuration. */
export async function getMetaAccessToken(env: MetaEnvironment): Promise<string> {
  const token = env.META_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new MetaTokenManagerError('Thiếu META_ACCESS_TOKEN trong cấu hình server.', 'meta_not_configured');
  }
  return token;
}
