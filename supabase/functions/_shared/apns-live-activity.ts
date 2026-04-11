// APNs helper for sending Live Activity push updates
// Uses .p8 auth key (same as push notifications)

let cachedApnsToken: { token: string; expiresAt: number } | null = null;
type ApnsEnvironment = 'development' | 'production';
let cachedApnsEnvironment: ApnsEnvironment | null = null;

const APNS_HOSTS: Record<ApnsEnvironment, string> = {
  development: 'https://api.sandbox.push.apple.com',
  production: 'https://api.push.apple.com',
};

function getApnsEnvironmentCandidates(): ApnsEnvironment[] {
  const configuredEnvironment = Deno.env.get('APNS_ENVIRONMENT');
  const candidates: ApnsEnvironment[] = [];

  const addCandidate = (env?: string | null) => {
    if ((env === 'development' || env === 'production') && !candidates.includes(env)) {
      candidates.push(env);
    }
  };

  addCandidate(cachedApnsEnvironment);
  addCandidate(configuredEnvironment);

  if (configuredEnvironment === 'development') {
    addCandidate('production');
  } else if (configuredEnvironment === 'production') {
    addCandidate('development');
  } else {
    addCandidate('production');
    addCandidate('development');
  }

  return candidates;
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getApnsToken(): Promise<string> {
  if (cachedApnsToken && Date.now() < cachedApnsToken.expiresAt - 60000) {
    return cachedApnsToken.token;
  }

  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  const privateKeyPem = Deno.env.get('APNS_AUTH_KEY_P8');

  if (!keyId || !teamId || !privateKeyPem) {
    throw new Error('Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_AUTH_KEY_P8');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import ES256 private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureRaw = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    encoder.encode(signingInput)
  );

  // Convert DER signature to raw r||s format for JWT
  const sigBytes = new Uint8Array(signatureRaw);
  const signatureB64 = base64UrlEncode(sigBytes);

  const jwt = `${signingInput}.${signatureB64}`;
  cachedApnsToken = { token: jwt, expiresAt: Date.now() + 50 * 60 * 1000 }; // ~50 min
  return jwt;
}

export interface LiveActivityUpdate {
  pushToken: string; // APNs push-to-update token from ActivityKit
  contentState: Record<string, unknown>; // The updated content state
  event?: 'update' | 'end'; // 'update' or 'end' the activity
  alertTitle?: string;
  alertBody?: string;
  sound?: string;
  staleDate?: number; // Unix timestamp when data becomes stale
  dismissalDate?: number; // Unix timestamp to auto-dismiss (for 'end')
  relevanceScore?: number; // 0-100
}

function buildApnsPayload(update: LiveActivityUpdate): Record<string, unknown> {
  return {
    aps: {
      timestamp: Math.floor(Date.now() / 1000),
      event: update.event || 'update',
      'content-state': update.contentState,
      ...(update.alertTitle && {
        alert: {
          title: update.alertTitle,
          body: update.alertBody || '',
        },
      }),
      ...(update.sound && { sound: update.sound }),
      ...(update.staleDate && { 'stale-date': update.staleDate }),
      ...(update.dismissalDate && { 'dismissal-date': update.dismissalDate }),
      ...(update.relevanceScore !== undefined && { 'relevance-score': update.relevanceScore }),
    },
  };
}

export async function sendLiveActivityUpdate(
  updates: LiveActivityUpdate[],
  bundleId: string
): Promise<number> {
  let token: string;
  try {
    token = await getApnsToken();
  } catch (err) {
    console.warn('APNs auth not configured, skipping Live Activity updates:', err);
    return 0;
  }

  let successCount = 0;

  for (const update of updates) {
    try {
      const apnsPayload = buildApnsPayload(update);
      const environments = getApnsEnvironmentCandidates();
      let delivered = false;
      let lastFailure: { environment: ApnsEnvironment; status: number; body: string } | null = null;

      for (let index = 0; index < environments.length; index++) {
        const environment = environments[index];
        const res = await fetch(`${APNS_HOSTS[environment]}/3/device/${update.pushToken}`, {
          method: 'POST',
          headers: {
            authorization: `bearer ${token}`,
            'apns-topic': `${bundleId}.push-type.liveactivity`,
            'apns-push-type': 'liveactivity',
            'apns-priority': '10',
          },
          body: JSON.stringify(apnsPayload),
        });

        if (res.ok) {
          cachedApnsEnvironment = environment;
          successCount++;
          delivered = true;
          break;
        }

        const errBody = await res.text();
        lastFailure = { environment, status: res.status, body: errBody };

        const shouldRetryAlternateEnvironment =
          res.status === 400 &&
          errBody.includes('BadDeviceToken') &&
          index < environments.length - 1;

        if (shouldRetryAlternateEnvironment) {
          console.warn(`APNs Live Activity push failed in ${environment}, retrying alternate environment: ${errBody}`);
        } else {
          break;
        }
      }

      if (!delivered && lastFailure) {
        console.error(
          `APNs Live Activity push failed [${lastFailure.environment}]: ${lastFailure.status} ${lastFailure.body}`
        );
      }
    } catch (err) {
      console.error('APNs Live Activity send error:', err);
    }
  }

  return successCount;
}
