import { createSign } from 'node:crypto';

/**
 * FCM HTTP v1 발송. FIREBASE_SERVICE_ACCOUNT(JSON 문자열)가 없으면 보내지 않고 이유만 돌려준다.
 * Firebase 프로젝트는 미니멀리딩과 별도로 만든다.
 */
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return raw ? (JSON.parse(raw) as ServiceAccount) : null;
}

async function accessToken(sa: ServiceAccount) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function sendPush(
  token: string,
  message: { title: string; body: string; data?: Record<string, string> },
): Promise<{ ok: boolean; error?: string }> {
  const sa = serviceAccount();
  if (!sa) return { ok: false, error: 'FIREBASE_SERVICE_ACCOUNT not set' };
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: { token, notification: { title: message.title, body: message.body }, data: message.data },
      }),
    });
    if (res.ok) return { ok: true };
    // 예: THIRD_PARTY_AUTH_ERROR(APNs 키 문제), UNREGISTERED(앱 삭제로 토큰 만료)
    const detail = (await res.json().catch(() => null)) as { error?: { details?: { errorCode?: string }[] } } | null;
    return { ok: false, error: `fcm ${res.status} ${detail?.error?.details?.find(d => d.errorCode)?.errorCode ?? ''}`.trim() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
