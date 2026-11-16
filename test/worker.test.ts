// Tests for worker.js (NOR-381, added with the dev tooling). They run the
// Worker's fetch handler as it is, in-process under Node, with small fakes
// for its bindings (KV, R2, Vectorize, Workers AI), so nothing leaves the
// machine. They say nothing about a deployed Worker.

import { describe, expect, it } from "vitest";
import worker from "../worker.js";

interface FakeOpts {
  kv?: Record<string, string>;
  files?: Record<string, string>;
  matches?: {
    id: string;
    score: number;
    metadata?: { source?: string; text?: string };
  }[];
}

function fakeEnv(opts: FakeOpts = {}) {
  const kv = opts.kv ?? {};
  const files = opts.files ?? {};
  const inserted: {
    id: string;
    metadata: { source: string; chunk_index: number };
  }[][] = [];
  const aiCalls: { model: string; input: Record<string, unknown> }[] = [];
  const listPrefixes: (string | undefined)[] = [];
  const env = {
    BREADCRUMBS: {
      async get(key: string) {
        return key in kv ? kv[key] : null;
      },
      async list() {
        return { keys: Object.keys(kv).map((name) => ({ name })) };
      },
    },
    MEMOIR_BUCKET: {
      async list(o?: { prefix?: string }) {
        listPrefixes.push(o?.prefix);
        const prefix = o?.prefix ?? "";
        return {
          objects: Object.keys(files)
            .filter((k) => k.startsWith(prefix))
            .map((key) => ({
              key,
              size: files[key].length,
              uploaded: new Date(0),
            })),
        };
      },
      async get(key: string) {
        return { text: async () => files[key] };
      },
    },
    VECTORIZE: {
      async query() {
        return { matches: opts.matches ?? [] };
      },
      async insert(
        v: { id: string; metadata: { source: string; chunk_index: number } }[],
      ) {
        inserted.push([...v]);
      },
    },
    AI: {
      async run(model: string, input: Record<string, unknown>) {
        aiCalls.push({ model, input });
        if (model === "@cf/baai/bge-large-en-v1.5")
          return { data: [[0.1, 0.2]] };
        if (input.stream) return "data: streamed\n\n";
        return { response: "a reply" };
      },
    },
  };
  return { env, inserted, aiCalls, listPrefixes };
}

function req(method: string, path: string, body?: unknown) {
  return new Request(`https://pair.example${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("worker.js", () => {
  it("answers a CORS preflight", async () => {
    const res = await worker.fetch(req("OPTIONS", "/chat"), fakeEnv().env);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("reports health", async () => {
    const res = await worker.fetch(req("GET", "/health"), fakeEnv().env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.service).toBe("northwoods");
  });

  it("reads substrate state, parsing JSON and keeping raw text", async () => {
    const { env } = fakeEnv({
      kv: {
        "where-landed": JSON.stringify({ _value: "home" }),
        "what-feels": "not json",
        "which-way-north:alpha": JSON.stringify({ step: 1 }),
        "which-way-north:beta": "plain",
        "which-way-north:empty": "",
        unrelated: "x",
      },
    });
    const res = await worker.fetch(req("GET", "/state"), env);
    const { substrate } = (await res.json()) as {
      substrate: Record<string, unknown>;
    };
    expect(substrate["where-landed"]).toEqual({ _value: "home" });
    expect(substrate["what-feels"]).toBe("not json");
    expect(substrate["what-decided"]).toBeNull();
    expect(substrate["which-way-north:alpha"]).toEqual({ step: 1 });
    expect(substrate["which-way-north:beta"]).toBe("plain");
    expect(substrate["which-way-north:empty"]).toBeNull();
    expect(substrate.unrelated).toBeUndefined();
  });

  it("lists the uploaded writing", async () => {
    const { env } = fakeEnv({ files: { "a.md": "hello" } });
    const res = await worker.fetch(req("GET", "/memoir/list"), env);
    expect(await res.json()).toEqual({
      count: 1,
      objects: [{ key: "a.md", size: 5, uploaded: new Date(0).toISOString() }],
    });
  });

  it("ingests every file, chunking long text with overlap and batching inserts", async () => {
    const para = "word ".repeat(60).trim();
    const long = Array.from({ length: 60 }, () => para).join("\n\n");
    const { env, inserted, listPrefixes } = fakeEnv({
      files: { "a.md": long, "b.md": "short note" },
    });
    const res = await worker.fetch(req("POST", "/ingest", {}), env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.files).toBe(2);
    expect(body.prefix).toBe("(all)");
    expect(listPrefixes).toEqual([""]);
    const total = inserted.reduce((n, batch) => n + batch.length, 0);
    expect(body.ingested).toBe(total);
    expect(inserted[0]).toHaveLength(50);
    expect(inserted.at(-1)?.[0].metadata.source).toBe("b.md");
  });

  it("ingests only the given prefix", async () => {
    const { env, listPrefixes } = fakeEnv({
      files: { "j/1.md": "x", "k/2.md": "y" },
    });
    const res = await worker.fetch(
      req("POST", "/ingest", { prefix: "j/" }),
      env,
    );
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ files: 1, ingested: 1, prefix: "j/" });
    expect(listPrefixes).toEqual(["j/"]);
  });

  it("refuses a chat with no message", async () => {
    const res = await worker.fetch(req("POST", "/chat", {}), fakeEnv().env);
    expect(res.status).toBe(400);
  });

  it("streams a chat by default, grounded in substrate and passages", async () => {
    const { env, aiCalls } = fakeEnv({
      kv: {
        register: JSON.stringify({ _value: "calm", _written_by: "pilot" }),
        "what-carries": JSON.stringify("plain value"),
      },
      matches: [
        {
          id: "m1",
          score: 0.9,
          metadata: { source: "a.md", text: "passage one" },
        },
        {
          id: "m2",
          score: 0.8,
          metadata: { source: "a.md", text: "same source" },
        },
        { id: "m3", score: 0.7 },
        { id: "m4", score: 0.6, metadata: { source: "c.md" } },
        { id: "m5", score: 0.5, metadata: { source: "d.md", text: "four" } },
        { id: "m6", score: 0.4, metadata: { source: "e.md", text: "five" } },
        { id: "m7", score: 0.3, metadata: { source: "f.md", text: "six" } },
      ],
    });
    const res = await worker.fetch(
      req("POST", "/chat", { message: "hi" }),
      env,
    );
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(await res.text()).toBe("data: streamed\n\n");
    const chat = aiCalls.find((c) => c.input.messages);
    const system = (chat?.input.messages as { content: string }[])[0].content;
    expect(chat?.model).toBe("@cf/meta/llama-4-scout-17b-16e-instruct");
    expect(system).toContain('- register: "calm" (written by pilot)');
    expect(system).toContain('- what-carries: "plain value"');
    expect(system).toContain("passage one\n(source: a.md, relevance: 0.900)");
    expect(system).not.toContain("same source");
    expect(system).toContain("(source: m3, relevance: 0.700)");
    expect(system).toContain("five");
    expect(system).not.toContain("six");
  });

  it("answers a chat without streaming on request, with a chosen model and no context", async () => {
    const { env, aiCalls } = fakeEnv();
    const res = await worker.fetch(
      req("POST", "/chat", {
        message: "hi",
        model: "@cf/other",
        stream: false,
      }),
      env,
    );
    expect(await res.json()).toEqual({ response: "a reply" });
    const chat = aiCalls.find((c) => c.input.messages);
    expect(chat?.model).toBe("@cf/other");
    const system = (chat?.input.messages as { content: string }[])[0].content;
    expect(system).not.toContain("current substrate state");
    expect(system).not.toContain("Relevant passages");
  });

  it("returns not found with a hint", async () => {
    const res = await worker.fetch(req("GET", "/nowhere"), fakeEnv().env);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { hint: string }).hint).toContain(
      "POST /chat",
    );
  });
});
