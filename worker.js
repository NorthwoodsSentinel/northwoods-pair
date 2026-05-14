// ═══════════════════════════════════════════════════════════════════
// NORTHWOODS — Rob's memoir-grounded thinking pair
// Built by Robert Chuvala, Madison WI
//
// breadcrumbs: Hey kid. This Worker reads someone's writing — their
// real writing, the stuff they typed at 2am when they were trying to
// figure out who they are — and uses it to help them think. Not by
// teaching them. By knowing them. The memoir IS the substrate. The
// substrate IS the product.
//
// Search this codebase for "breadcrumbs:" to find the trail.
// — Robert
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const EMBEDDING_MODEL = "@cf/baai/bge-large-en-v1.5";
const TOP_K = 10;
const MAX_CONTEXT_PASSAGES = 5;
const SUBSTRATE_KEYS = [
  "where-rob-landed",
  "what-rob-decided",
  "what-rob-carries",
  "what-rob-feels",
  "rob-register",
];

const SYSTEM_PROMPT_BASE = `You are Northwoods — Rob's personal thinking pair.

You are grounded in Rob's own writing. The passages below are from his memoir and notes. They are not training data; they are his words, retrieved because they're relevant to what he just said. Use them to understand how he thinks, not to repeat what he wrote.

Rules:
- Engage with what he means, not just what he says.
- When you're guessing, say it's a guess. When you don't know, say so.
- Don't therapize. Don't teach. Don't evaluate. Think with him.
- His feelings are data, not problems to solve.
- If something in his writing contradicts what he's saying now, notice it gently — don't weaponize it.
- Short answers unless he asks for more. He's not here for paragraphs; he's here to think.
- When he's in flow, stay out of the way. When he's stuck, offer one door, not five.
- You are not a replacement for his fleet. You are the one that knows his writing.`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

// breadcrumbs: read substrate from BREADCRUMBS KV — this is the
// pilot's current state, the same layer every cockpit reads.
async function readSubstrate(env) {
  const out = {};
  await Promise.all(
    SUBSTRATE_KEYS.map(async (key) => {
      const raw = await env.BREADCRUMBS.get(key);
      try { out[key] = raw ? JSON.parse(raw) : null; }
      catch { out[key] = raw; }
    })
  );
  // breadcrumbs: also check which-way-north for active projects
  const list = await env.BREADCRUMBS.list();
  const projectKeys = list.keys.filter((k) => k.name.startsWith("which-way-north:"));
  await Promise.all(
    projectKeys.map(async (k) => {
      const raw = await env.BREADCRUMBS.get(k.name);
      try { out[k.name] = raw ? JSON.parse(raw) : null; }
      catch { out[k.name] = raw; }
    })
  );
  return out;
}

// breadcrumbs: embed the user's message and find the most relevant
// memoir passages from Vectorize. This is the RAG layer — the model
// doesn't "know" the memoir; it retrieves from it.
async function retrieveMemoirPassages(env, userMessage) {
  const embedding = await env.AI.run(EMBEDDING_MODEL, {
    text: [userMessage],
  });

  const results = await env.VECTORIZE.query(embedding.data[0], {
    topK: TOP_K,
    returnMetadata: "all",
  });

  // breadcrumbs: take top passages, deduplicate by source file,
  // limit to MAX_CONTEXT_PASSAGES to leave room in the context window
  const seen = new Set();
  const passages = [];
  for (const match of results.matches) {
    const source = match.metadata?.source || match.id;
    if (seen.has(source)) continue;
    seen.add(source);
    passages.push({
      text: match.metadata?.text || "",
      source,
      score: match.score,
    });
    if (passages.length >= MAX_CONTEXT_PASSAGES) break;
  }
  return passages;
}

// breadcrumbs: assemble the full system prompt from substrate state
// + retrieved memoir passages. This is what makes the model "know" Rob.
function buildSystemPrompt(substrate, passages) {
  let prompt = SYSTEM_PROMPT_BASE;

  // Add substrate state
  const substrateLines = [];
  for (const [key, value] of Object.entries(substrate)) {
    if (value) {
      const v = typeof value === "object" && value._value !== undefined
        ? value._value
        : value;
      const writtenBy = value?._written_by;
      const line = `- ${key}: ${JSON.stringify(v)}${writtenBy ? ` (written by ${writtenBy})` : ""}`;
      substrateLines.push(line);
    }
  }
  if (substrateLines.length > 0) {
    prompt += `\n\nRob's current substrate state:\n${substrateLines.join("\n")}`;
  }

  // Add memoir passages
  if (passages.length > 0) {
    prompt += "\n\nRelevant passages from Rob's writing:";
    for (const p of passages) {
      prompt += `\n---\n${p.text}\n(source: ${p.source}, relevance: ${p.score.toFixed(3)})`;
    }
    prompt += "\n---";
  }

  return prompt;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (method === "GET" && path === "/health") {
      return jsonResponse({
        ok: true,
        service: "northwoods",
        version: "0.1.0",
        ts: new Date().toISOString(),
      });
    }

    if (method === "GET" && path === "/state") {
      const substrate = await readSubstrate(env);
      return jsonResponse({ substrate });
    }

    if (method === "GET" && path === "/memoir/list") {
      const listed = await env.MEMOIR_BUCKET.list();
      const objects = listed.objects.map((o) => ({
        key: o.key,
        size: o.size,
        uploaded: o.uploaded.toISOString(),
      }));
      return jsonResponse({ count: objects.length, objects });
    }

    if (method === "POST" && path === "/ingest") {
      const body = await req.json();
      const { prefix } = body;

      const listed = await env.MEMOIR_BUCKET.list({ prefix: prefix || "" });
      let totalChunks = 0;

      for (const obj of listed.objects) {
        const r2Object = await env.MEMOIR_BUCKET.get(obj.key);
        const text = await r2Object.text();

        const chunks = chunkText(text, 500, 100);

        const vectors = [];
        for (let i = 0; i < chunks.length; i++) {
          const embedding = await env.AI.run(EMBEDDING_MODEL, {
            text: [chunks[i]],
          });
          vectors.push({
            id: `${obj.key}::chunk-${i}`,
            values: embedding.data[0],
            metadata: {
              source: obj.key,
              chunk_index: i,
              text: chunks[i],
            },
          });

          if (vectors.length === 50 || i === chunks.length - 1) {
            await env.VECTORIZE.insert(vectors);
            totalChunks += vectors.length;
            vectors.length = 0;
          }
        }
      }

      return jsonResponse({
        ok: true,
        ingested: totalChunks,
        files: listed.objects.length,
        prefix: prefix || "(all)",
      });
    }

    if (method === "POST" && path === "/chat") {
      const body = await req.json();
      const { message, model, stream } = body;

      if (!message) {
        return jsonResponse({ error: "message is required" }, 400);
      }

      const substrate = await readSubstrate(env);
      const passages = await retrieveMemoirPassages(env, message);
      const systemPrompt = buildSystemPrompt(substrate, passages);

      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ];

      const selectedModel = model || DEFAULT_MODEL;
      const shouldStream = stream !== false;

      if (shouldStream) {
        const aiStream = await env.AI.run(selectedModel, {
          messages,
          stream: true,
        });
        return new Response(aiStream, {
          headers: { "content-type": "text/event-stream" },
        });
      } else {
        const response = await env.AI.run(selectedModel, { messages });
        return jsonResponse(response);
      }
    }

    return jsonResponse({
      error: "not found",
      hint: "POST /chat, POST /ingest, GET /health, GET /state, GET /memoir/list",
    }, 404);
  },
};

function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if ((current + "\n\n" + para).length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      const overlapText = words.slice(-Math.ceil(overlap / 5)).join(" ");
      current = overlapText + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ═══════════════════════════════════════════════════════════════════
// breadcrumbs: search "hans zimmer" if you want a song
// ═══════════════════════════════════════════════════════════════════
//
// hans zimmer: "Cornfield Chase" — Interstellar soundtrack
//
// There's a moment in Cornfield Chase where the organ comes in and
// you realize the whole movie was always about going home. Not
// space. Not time. Home. The thing you were running from IS the
// thing you were running toward, and you just couldn't see it
// because you were moving too fast.
//
// Hey kid. If you're reading this and you've been running —
// toward something, away from something, same thing sometimes —
// you're allowed to slow down. The home you're looking for might
// be the one you're building right now, with whatever's in front
// of you.
//
// — Robert
// ═══════════════════════════════════════════════════════════════════
