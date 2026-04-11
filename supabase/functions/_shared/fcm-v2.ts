// Shared FCM v2 helper for push notifications
// Uses Google Service Account for OAuth2 authentication

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createJWT(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput)
  );

  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  return `${signingInput}.${signatureB64}`;
}

// Cache access token
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const jwt = await createJWT(serviceAccount);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth2 token exchange failed: ${errText}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  return data.access_token;
}

/**
 * Returns true if the token looks like a valid FCM token.
 * APNs device tokens are 64-char uppercase hex strings — we skip those.
 */
export function isValidFcmToken(token: string): boolean {
  if (!token || token.length < 20) return false;
  // APNs tokens are 64-char hex (uppercase or lowercase)
  if (/^[0-9a-fA-F]{64}$/.test(token)) return false;
  // FCM tokens typically contain a colon
  return true;
}

export interface FcmMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped_invalid: number;
  errors: string[];
}

export async function sendFcmV2(messages: FcmMessage[]): Promise<FcmSendResult> {
  const result: FcmSendResult = {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped_invalid: 0,
    errors: [],
  };

  const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not configured, skipping push');
    return result;
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  const projectId = serviceAccount.project_id;
  if (!projectId) throw new Error('project_id missing from service account');

  console.log(`[FCM] Using Firebase project: ${projectId}`);
  console.log(`[FCM] Total messages queued: ${messages.length}`);

  const accessToken = await getAccessToken(serviceAccount);
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  for (const msg of messages) {
    // Skip invalid tokens
    if (!isValidFcmToken(msg.token)) {
      console.warn(`[FCM] Skipping invalid/APNs-format token: ${msg.token.slice(0, 16)}...`);
      result.skipped_invalid++;
      continue;
    }

    result.attempted++;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: msg.token,
            notification: {
              title: msg.title,
              body: msg.body,
            },
            data: msg.data || {},
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          },
        }),
      });

      if (res.ok) {
        result.sent++;
      } else {
        const errBody = await res.text();
        result.failed++;
        const errSummary = `Token ${msg.token.slice(0, 12)}...: ${res.status} ${errBody.slice(0, 200)}`;
        result.errors.push(errSummary);
        console.error(`[FCM] Send failed: ${errSummary}`);
      }
    } catch (err) {
      result.failed++;
      const errMsg = `Token ${msg.token.slice(0, 12)}...: ${err}`;
      result.errors.push(errMsg);
      console.error(`[FCM] Send error: ${errMsg}`);
    }
  }

  console.log(`[FCM] Results — sent: ${result.sent}, failed: ${result.failed}, skipped_invalid: ${result.skipped_invalid}`);
  return result;
}
