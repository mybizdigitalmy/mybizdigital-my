/* MyBizDigital newsletter: fail-closed Brevo DOI endpoint. No client-side secrets. */
const json = (body, status = 200) => new Response(JSON.stringify(body),{
  status,
  headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const getEnv = key => Netlify.env.get(key) || '';
const configured = () => {
  const template = Number(getEnv('BREVO_DOI_TEMPLATE_ID'));
  return !!getEnv('BREVO_API_KEY') && Number.isSafeInteger(template) && template > 0 &&
    !!getEnv('TURNSTILE_SITE_KEY') && !!getEnv('TURNSTILE_SECRET_KEY');
};
export const config = {
  rateLimit: { action:'rate_limit', aggregateBy:'ip', windowSize:60, windowLimit:5 }
};
export default async function handler(request, context) {
  if (request.method === 'GET') {
    return json({ready:configured(),siteKey:configured()?getEnv('TURNSTILE_SITE_KEY'):null});
  }
  if (request.method !== 'POST') return json({error:'Method not allowed'},405);
  const origin = new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return json({error:'Forbidden'},403);
  if (!configured()) return json({error:'Service not configured'},503);
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) {
    return json({error:'Invalid request'},415);
  }
  let data;
  try {
    const payload = await request.text();
    if (payload.length > 2048) return json({error:'Request too large'},413);
    data = JSON.parse(payload);
  } catch (_) { return json({error:'Invalid request'},400); }
  if (!data || data.consent !== true || typeof data.email !== 'string') return json({error:'Invalid request'},400);
  if (data.website) return json({ok:true},201); // Honeypot: silently accept bots.
  const email=data.email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Invalid email'},400);
  if (typeof data.challengeToken !== 'string' || !data.challengeToken || data.challengeToken.length > 2048) {
    return json({error:'Security verification required'},400);
  }

  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        secret:getEnv('TURNSTILE_SECRET_KEY'),response:data.challengeToken,
        remoteip:context.ip || ''
      }),signal:AbortSignal.timeout(8000)
    });
    if (!verify.ok) return json({error:'Security check unavailable'},503);
    const check=await verify.json();
    if (!check.success || check.hostname !== new URL(request.url).hostname || check.action !== 'mbd_newsletter') {
      return json({error:'Security verification failed'},400);
    }
    const result=await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','api-key':getEnv('BREVO_API_KEY')},
      body:JSON.stringify({
        email,
        includeListIds:[3],
        templateId:Number(getEnv('BREVO_DOI_TEMPLATE_ID')),
        redirectionUrl:origin + '/?newsletter=confirmed#mbd-site-footer',
        contactPixelTrackingConsent:false
      }),
      signal:AbortSignal.timeout(10000)
    });
    if (!result.ok) return json({error:'Unable to process subscription'},502);
    return json({ok:true},201);
  } catch (_) { return json({error:'Newsletter temporarily unavailable'},503); }
}
