// Supabase Edge Function: mentor-ai
// Generates AI study notes / practice drills / presentation feedback for a mentor's topic.
// Deploy:  supabase functions deploy mentor-ai
// Set key: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// The app calls it via supabase.functions.invoke('mentor-ai', { body: { kind, topic, path, ppt } }).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { kind, topic, path, ppt } = await req.json()
    const key = Deno.env.get('ANTHROPIC_API_KEY')
    if (!key) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)

    const prompts: Record<string, string> = {
      notes: `You are preparing a trainer to teach "${topic}" (${path}). Write detailed, well-structured study notes a new mentor can learn from: key concepts, clear definitions, worked examples, and common pitfalls. Use headings and bullet points.`,
      practice: `You are preparing a trainer to deliver live training on "${topic}" (${path}). List concrete practice activities and rehearsal scenarios so the mentor is ready to teach it: hands-on exercises, likely student questions with answers, and a short mock-delivery outline.`,
      feedback: `Give constructive, specific, encouraging feedback to a mentor about their presentation for "${topic}" (${path})${ppt ? ` (link: ${ppt})` : ''}. Cover structure, clarity, depth, pacing, and delivery tips.`,
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompts[kind] || prompts.notes }],
      }),
    })
    const j = await r.json()
    const text = j?.content?.[0]?.text || ''
    return json({ text })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
