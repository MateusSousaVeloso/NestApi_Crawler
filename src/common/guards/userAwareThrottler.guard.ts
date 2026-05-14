import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { createHash } from 'node:crypto';

// Decodifica o payload do JWT sem verificar assinatura (só para fins de rastreamento do throttler).
// A autenticação real continua sendo feita pelo AccessTokenGuard via Passport.
function extractUserIdFromCookie(cookieValue: string): string | null {
  try {
    const [, payloadB64] = cookieValue.split('.');
    if (!payloadB64) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as { id?: string };
    return payload?.id ?? null;
  } catch {
    return null;
  }
}

@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, any>): Promise<string> {
    const cookieName = process.env.ACCESS_TOKEN || 'access_token';
    const token = (req as any).cookies?.[cookieName] as string | undefined;

    if (token) {
      const userId = extractUserIdFromCookie(token);
      if (userId) return `user:${userId}`;
    }

    // Fallback: IP + hash dos primeiros 8 chars do User-Agent (mitiga CGNAT puro)
    const forwarded = req.headers?.['x-forwarded-for'] as string | undefined;
    const ip = forwarded?.split(',')[0]?.trim() ?? (req as any).ip ?? 'unknown';
    const ua = (req.headers?.['user-agent'] as string) ?? '';
    const uaHash = createHash('sha256').update(ua).digest('hex').substring(0, 8);
    return `ip:${ip}:${uaHash}`;
  }
}
