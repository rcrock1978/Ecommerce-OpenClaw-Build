// ── Helpers ─────────────────────────────────────────────────────────

function generateTokens(payload: AuthPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL } as any);
  const refreshToken = jwt.sign(
    { userId: payload.userId, tokenVersion: 0 } satisfies RefreshPayload,
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL } as any,
  );
  return { accessToken, refreshToken };
}