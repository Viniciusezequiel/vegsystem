export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function allowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const allowed = String(env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

export function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {};
}

export function optionsResponse(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: 'origin_not_allowed' }, 403);
  return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,HEAD,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  } });
}
