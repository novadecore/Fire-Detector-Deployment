export async function POST(req: Request) {
    const body = await req.json();
    const base = process.env.PY_BACKEND_URL!;
    const r = await fetch(`${base}/api/sensors/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    const ct = r.headers.get('content-type') ?? 'application/json';
    return new Response(text, { status: r.status, headers: { 'content-type': ct } });
  }
  