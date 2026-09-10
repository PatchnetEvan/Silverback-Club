const MAX_FORM_BYTES = 16_384;
const TURNSTILE_ACTION = 'subscribe';

interface TurnstileResult {
  success: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

function cleanField(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
}

function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function expectedHostnames(env: Env): Set<string> {
  return new Set(env.TURNSTILE_HOSTNAMES.split(',').map((hostname) => hostname.trim()).filter(Boolean));
}

async function verifyTurnstile(token: string, remoteIp: string | null, env: Env): Promise<boolean> {
  const hostnames = expectedHostnames(env);
  if (!env.TURNSTILE_SECRET || token.length === 0 || token.length > 2048 || hostnames.size === 0) return false;

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object') return false;
    const verification = result as TurnstileResult;
    return verification.success === true
      && verification.action === TURNSTILE_ACTION
      && typeof verification.hostname === 'string'
      && hostnames.has(verification.hostname);
  } catch (error) {
    console.error(JSON.stringify({ message: 'turnstile verification failed', error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

// Cloudflare Email Sending, through the `send_email` binding — no API key, no
// third party. The same route pro.threetwone.com already uses for its own mail.
//
// The `from` domain must be onboarded onto Email Sending first
// (`wrangler email sending enable silverbackbarbell.com`), which is what writes
// the DKIM records into the zone. Until that is done this throws, which is why
// the caller treats a failed notification as non-fatal: the subscriber row is
// already committed and losing the notification must not lose the signup.
async function sendSignupNotification(subscriber: { firstName: string; lastName: string; email: string; country: string | null }, env: Env): Promise<void> {
  // Unset is an ordinary state before the domain is onboarded, not a fault.
  // Skip quietly rather than throwing once per signup into the error log.
  if (!env.SIGNUP_NOTIFICATION_TO || !env.SIGNUP_NOTIFICATION_FROM) {
    console.log(JSON.stringify({ message: 'signup notification not configured; skipping' }));
    return;
  }
  const name = `${subscriber.firstName} ${subscriber.lastName}`;
  await env.EMAIL.send({
    to: env.SIGNUP_NOTIFICATION_TO,
    from: { email: env.SIGNUP_NOTIFICATION_FROM, name: 'SilverBack Barbell Club' },
    // The subscriber's own address, so replying to the notification reaches
    // them rather than the Worker's send-only mailbox.
    replyTo: subscriber.email,
    subject: `New SilverBack signup: ${name}`,
    text: `New SilverBack Barbell Club signup\n\nName: ${name}\nEmail: ${subscriber.email}\nCountry: ${subscriber.country ?? 'Unknown'}`,
    html: `<p>New SilverBack Barbell Club signup</p><dl><dt>Name</dt><dd>${escapeHtml(name)}</dd><dt>Email</dt><dd>${escapeHtml(subscriber.email)}</dd><dt>Country</dt><dd>${escapeHtml(subscriber.country ?? 'Unknown')}</dd></dl>`,
  });
}

async function assetPage(request: Request, env: Env, pathname: string, status: number): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  const asset = await env.ASSETS.fetch(new Request(url, { method: 'GET', headers: request.headers }));
  const headers = new Headers(asset.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(asset.body, { status, headers });
}

async function subscribe(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_FORM_BYTES) return assetPage(request, env, '/subscribe/invalid/', 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return assetPage(request, env, '/subscribe/invalid/', 400);
  }

  const firstName = cleanField(form.get('first_name'), 80);
  const lastName = cleanField(form.get('last_name'), 80);
  const email = cleanField(form.get('email'), 254)?.toLowerCase() ?? null;
  const token = cleanField(form.get('cf-turnstile-response'), 2048);
  const source = 'homepage';
  if (!firstName || !lastName || !email || !isEmail(email)) return assetPage(request, env, '/subscribe/invalid/', 400);
  if (!token || !await verifyTurnstile(token, request.headers.get('CF-Connecting-IP'), env)) {
    return assetPage(request, env, '/subscribe/verification/', 403);
  }

  const country = cleanField(request.headers.get('CF-IPCountry'), 2);
  try {
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO subscribers (id, first_name, last_name, email, created_at, ip_country, source)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), firstName, lastName, email, new Date().toISOString(), country, source).run();

    if (result.meta.changes > 0) {
      ctx.waitUntil(sendSignupNotification({ firstName, lastName, email, country }, env).catch((error) => {
        console.error(JSON.stringify({ message: 'signup notification failed', error: error instanceof Error ? error.message : String(error) }));
      }));
    }
    return assetPage(request, env, '/subscribe/success/', 200);
  } catch (error) {
    console.error(JSON.stringify({ message: 'subscriber insert failed', error: error instanceof Error ? error.message : String(error) }));
    return assetPage(request, env, '/subscribe/unavailable/', 503);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/subscribe') {
      if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
      return subscribe(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
