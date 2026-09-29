interface RequestSample {
  bytes: number;
  status: number;
  totalMs: number;
  ttfbMs: number;
}

interface RouteBenchmark {
  headers: Record<string, string | null>;
  label: string;
  samples: RequestSample[];
  url: string;
}

const DEFAULT_ROUNDS = 20;
const DEFAULT_TIMEOUT_MS = 15_000;
const PERCENTILE_50 = 0.5;
const PERCENTILE_95 = 0.95;
const baseUrl = (process.env.BENCH_BASE_URL ?? "http://localhost:5175").replace(
  /\/$/,
  ""
);
const rounds = Number.parseInt(
  process.env.BENCH_ROUNDS ?? String(DEFAULT_ROUNDS),
  10
);
const timeoutMs = Number.parseInt(
  process.env.BENCH_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
  10
);
const keyword = process.env.BENCH_QUERY ?? "productivity";
const toolSlug = process.env.BENCH_TOOL_SLUG;
const imageUrl = process.env.BENCH_IMAGE_URL;

if (!(Number.isInteger(rounds) && rounds > 0)) {
  throw new Error("BENCH_ROUNDS must be a positive integer");
}
if (!(Number.isInteger(timeoutMs) && timeoutMs > 0)) {
  throw new Error("BENCH_TIMEOUT_MS must be a positive integer");
}

const percentile = (values: number[], percentileValue: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index] ?? 0;
};

const formatMs = (value: number): string => `${value.toFixed(1)} ms`;

const request = async (url: string): Promise<{
  headers: Headers;
  sample: RequestSample;
}> => {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: { Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const headersAt = performance.now();
  const body = await response.arrayBuffer();
  const completedAt = performance.now();

  return {
    headers: response.headers,
    sample: {
      bytes: body.byteLength,
      status: response.status,
      ttfbMs: headersAt - startedAt,
      totalMs: completedAt - startedAt,
    },
  };
};

const benchmarkRoute = async (
  label: string,
  url: string
): Promise<RouteBenchmark> => {
  const samples: RequestSample[] = [];
  let latestHeaders = new Headers();

  for (let iteration = 0; iteration < rounds; iteration += 1) {
    const result = await request(url);
    samples.push(result.sample);
    latestHeaders = result.headers;
  }

  return {
    label,
    url,
    samples,
    headers: {
      age: latestHeaders.get("age"),
      cacheControl: latestHeaders.get("cache-control"),
      cfCacheStatus: latestHeaders.get("cf-cache-status"),
      contentType: latestHeaders.get("content-type"),
      nextCache: latestHeaders.get("x-nextjs-cache"),
    },
  };
};

const printBenchmark = (benchmark: RouteBenchmark): void => {
  const ttfbValues = benchmark.samples.map((sample) => sample.ttfbMs);
  const totalValues = benchmark.samples.map((sample) => sample.totalMs);
  const first = benchmark.samples[0];
  const statuses = [...new Set(benchmark.samples.map((sample) => sample.status))];

  console.log(`\n${benchmark.label}: ${benchmark.url}`);
  console.log(`  status=${statuses.join(",")} bytes=${first?.bytes ?? 0}`);
  console.log(
    `  TTFB cold=${formatMs(first?.ttfbMs ?? 0)} p50=${formatMs(percentile(ttfbValues, PERCENTILE_50))} p95=${formatMs(percentile(ttfbValues, PERCENTILE_95))}`
  );
  console.log(
    `  total p50=${formatMs(percentile(totalValues, PERCENTILE_50))} p95=${formatMs(percentile(totalValues, PERCENTILE_95))}`
  );
  console.log(`  cache headers=${JSON.stringify(benchmark.headers)}`);
};

const readDockerStats = async (): Promise<string> => {
  const process = Bun.spawn(
    [
      "docker",
      "stats",
      "--no-stream",
      "--format",
      "{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}",
    ],
    { stderr: "pipe", stdout: "pipe" }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    return `Unavailable: ${stderr.trim()}`;
  }
  return stdout.trim();
};

const routes = [
  { label: "Home", url: `${baseUrl}/en` },
  { label: "Tools", url: `${baseUrl}/en/tools` },
  {
    label: "Keyword search",
    url: `${baseUrl}/en/tools?q=${encodeURIComponent(keyword)}&mode=keyword`,
  },
  {
    label: "Semantic search",
    url: `${baseUrl}/en/tools?q=${encodeURIComponent(keyword)}&mode=semantic`,
  },
];

if (toolSlug) {
  routes.splice(2, 0, {
    label: "Tool detail",
    url: `${baseUrl}/en/tools/${encodeURIComponent(toolSlug)}`,
  });
}

if (imageUrl) {
  routes.push({ label: "Image delivery", url: imageUrl });
}

console.log(`App benchmark: ${rounds} sequential requests per route`);
console.log("Service resources before requests:");
console.log(await readDockerStats());

for (const route of routes) {
  const result = await benchmarkRoute(route.label, route.url);
  printBenchmark(result);
}

console.log("\nService resources after requests:");
console.log(await readDockerStats());

if (!toolSlug) {
  console.log("\nTool detail skipped: set BENCH_TOOL_SLUG to a published slug.");
}
if (!imageUrl) {
  console.log(
    "Image delivery skipped: set BENCH_IMAGE_URL to a screenshot or /_next/image URL."
  );
}
