# northwoods-pair

A memoir-grounded thinking pair you can run on your own Cloudflare account.

You sit down. You type something. The AI responds with **your own writing** as context — not training data about how humans work, your words about how you work. Built on Cloudflare's edge so your writing never leaves your account.

This is a forkable template. The Worker is ~300 lines of JavaScript. Each fork runs on the deployer's own CF account with their own substrate. Nothing is shared between deployments.

---

## ⚠️ Read this first — the aperture question

This Worker indexes your writing into a Vectorize index and retrieves passages by semantic similarity. **It does not filter by aperture out of the box.**

What that means in plain terms: if you upload a journal entry where you wrote about something painful, and later you ask the AI something casual that happens to be semantically near that pain — the AI will surface the painful passage as context. That's the design as-shipped.

For some uses (deeply private journaling, memoir-as-therapy, family-grief writing) this is wrong by default. You almost certainly do NOT want trauma-adjacent content retrieved into a "what should I cook tonight" prompt.

**Three ways to handle this:**

1. **Only ingest writing you're okay being surfaced anywhere.** Public-shape writing, voice writing, decisions-and-projects content. Keep the sacred stuff out of R2.
2. **Tag chunks with aperture metadata at ingest, filter at retrieval.** The Worker source has comments showing where this hook lives. You add: `aperture: operational | reflective | sacred` to each chunk's metadata, then filter the Vectorize query results by aperture vs your current state. ~30 lines of code.
3. **Run two indexes** — one for operational/reflective, one for sacred, retrieve only from the appropriate one based on user-set mode.

If you're putting your own writing in here, read this section twice. If you're helping a family member set this up, read it three times. One person's "operational" is another person's "sacred."

---

## What you get

When deployed, the Worker exposes:

- `GET /health` — service liveness check
- `GET /state` — current substrate state from your KV
- `GET /memoir/list` — what's in your R2 bucket
- `POST /ingest` — body `{"prefix": "memoir/"}`, chunks + embeds files in that R2 prefix into Vectorize
- `POST /chat` — body `{"message": "..."}`, returns a streamed response grounded in your retrieved writing + substrate

The model defaults to Llama 4 Scout (131K context). Switch to IBM Granite, gpt-oss, Nemotron, or any other Workers AI model with one constant.

---

## What's on your CF account when deployed

| Resource | Purpose | Free tier? |
|---|---|---|
| Worker | the service | yes (100K reqs/day) |
| KV namespace | your substrate state | yes |
| R2 bucket | your uploaded writing | yes (10 GB) |
| Vectorize index | searchable embeddings | yes (5M queried vectors/mo) |
| D1 database | reserved for v0.2 conversation history | yes |
| Workers AI | inference + embeddings | yes (10K Neurons/day) |

For one person doing thinking-pair work, this should fit free tier indefinitely. Heavy use (~100 messages/day) is pennies/mo at Granite pricing, low single-digit dollars at Scout.

---

## Deploy

Prerequisites: a Cloudflare account, `wrangler` CLI installed, Node ≥18.

```bash
# 1. Clone
git clone https://github.com/NorthwoodsSentinel/northwoods-pair.git
cd northwoods-pair

# 2. Change PERSON_NAME at the top of worker.js to your name
#    (look for the `CONFIGURE ME` block — one constant to edit)

# 3. Provision your bindings (one-time)
wrangler kv namespace create BREADCRUMBS
wrangler r2 bucket create your-bucket-name
wrangler vectorize create your-index-name --dimensions=1024 --metric=cosine
wrangler d1 create your-db-name

# 4. Open wrangler.toml and fill in the IDs returned by the commands above

# 5. Deploy
wrangler deploy

# 6. Upload your writing to R2
wrangler r2 object put your-bucket-name/memoir/my-writing.md --file ~/path/to/file.md

# 7. Build the index (one POST)
curl -X POST https://pair.<your-subdomain>.workers.dev/ingest \
  -H "Content-Type: application/json" \
  -d '{"prefix":"memoir/"}'

# 8. Chat
curl -X POST https://pair.<your-subdomain>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"what should I be thinking about today"}'
```

---

## Auth (please read before exposing publicly)

**As shipped, the Worker has CORS:`*` and no authentication on any endpoint.** That's fine for a Worker that's only reachable from your local machine via `wrangler dev`, or one you keep on a non-public route.

Before enabling a `workers.dev` subdomain or any public route, wire authentication:

- **Easiest:** Cloudflare Access in front of the route. Email-allowlist your own email. Anyone hitting the URL has to OAuth through Google/email-OTP before reaching the Worker. Zero code change.
- **Token-in-header:** add a `WRITE_TOKEN` secret in the Worker, check it in `fetch()` before any handler.
- **mTLS / client certificates** if you want stronger.

Whatever you pick, **wire it before exposing.** This Worker pulls from your own writing — keeping that private to you is the whole point.

---

## Breadcrumbs

The source has `// breadcrumbs:` comments at every architectural seam. They're notes from one builder to anyone who reads the code — kids, family members, future-you, whoever inherits the trail. Add your own.

The Hans Zimmer "Cornfield Chase" passage near the bottom is the original author's. **Yours goes there.** A song that means something to you, a poem, a piece of writing that reminds you who you are. Names are mission, not decoration; so are the comments.

---

## License

Apache 2.0. Fork freely, modify freely, run on your own infrastructure freely. Patent grant included.

If you ship this for someone you love, that's the point.

---

## Provenance

Built originally for the [northwoodssentinel.com](https://northwoodssentinel.com) personal thinking-pair (`pair v0.1`), as part of Robert Chuvala's broader work on personal AI infrastructure. The 4/6 essay ["Your AI has an accent you didn't choose"](https://northwoodssentinel.com/essays/2026-04-06-your-ai-has-an-accent-you-didnt-choose/) describes the communication-firmware doctrine the system prompt encodes.

This template exists because patterns travel. If yours teaches someone something we missed, send a PR.

---

*Built with care. Madison, WI. 2026.*
