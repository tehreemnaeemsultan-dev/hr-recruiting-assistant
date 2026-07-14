import "server-only";

// LinkedIn sourcing via Apify — COOKIELESS actors ONLY (SPEC §8.1).
// Default actor: harvestapi/linkedin-profile-search (no login/cookies; searches
// public profiles by title/location and returns full profile data in one run).
// Never use cookie/session actors; never automate LinkedIn messaging.

const APIFY_API = "https://api.apify.com/v2";

export function getSourcingActor(): string {
  return process.env.APIFY_LINKEDIN_ACTOR || "harvestapi~linkedin-profile-search";
}

export function isApifyConfigured(): boolean {
  return Boolean(process.env.APIFY_TOKEN);
}

function requireToken(): string {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set.");
  return t;
}

export interface SearchQuery {
  title: string;
  location?: string;
  company?: string;
  maxItems: number;
}

/** Build the cookieless HarvestAPI search actor input from the recruiter's query. */
export function buildSearchInput(q: SearchQuery): Record<string, unknown> {
  return {
    profileScraperMode: "Full",
    searchQuery: [q.title, q.company].filter(Boolean).join(" ").trim(),
    currentJobTitles: q.title ? [q.title] : [],
    locations: q.location ? [q.location] : [],
    maxItems: q.maxItems,
    takePages: 1,
  };
}

// --- Sourcing actor registry (cookieless only) ----------------------------
// Each source maps our query onto a specific Apify actor's input schema.
// Output shapes differ per actor, but normalizeProfile() below is defensive.

export interface SourceActor {
  id: string; // stable key used in the UI + form
  label: string;
  note: string;
  slug: string; // Apify actor slug (username~actor)
  buildInput: (q: SearchQuery) => Record<string, unknown>;
}

/** The cookieless actors the owner can choose between. Slugs are env-overridable. */
export function getSourceActors(): SourceActor[] {
  return [
    {
      id: "harvest",
      label: "HarvestAPI — role, location & company",
      note: "Best all-round. Filters by title, location and company.",
      slug: process.env.APIFY_LINKEDIN_ACTOR || "harvestapi~linkedin-profile-search",
      buildInput: buildSearchInput,
    },
    {
      id: "apimaestro",
      label: "apimaestro — role & location",
      note: "Alternative source. Uses title + location (company is ignored).",
      slug:
        process.env.APIFY_LINKEDIN_ACTOR_2 ||
        "apimaestro~linkedin-profile-search-scraper",
      buildInput: (q) => ({
        current_job_title: q.title || undefined,
        location: q.location || undefined,
        max_profiles: q.maxItems,
        include_email: false,
      }),
    },
  ];
}

function webhooksParam(): string | null {
  const appUrl = process.env.APP_URL;
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  // Only attach a webhook if we have a publicly reachable URL (not localhost).
  if (!appUrl || !secret || appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    return null;
  }
  const payload = [
    {
      eventTypes: ["ACTOR.RUN.SUCCEEDED", "ACTOR.RUN.FAILED"],
      requestUrl: `${appUrl}/api/apify/webhook?secret=${encodeURIComponent(secret)}`,
    },
  ];
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export interface StartedRun {
  runId: string;
  datasetId: string | null;
}

/** Start an actor run. Returns immediately (async) — do not wait for the scrape. */
export async function startProfileSearch(
  input: Record<string, unknown>,
  actorSlug: string = getSourcingActor(),
): Promise<StartedRun> {
  const token = requireToken();
  const actor = actorSlug;
  const wh = webhooksParam();
  const url =
    `${APIFY_API}/acts/${actor}/runs?token=${token}` +
    (wh ? `&webhooks=${encodeURIComponent(wh)}` : "");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify run failed to start: ${await res.text()}`);
  const json = await res.json();
  return {
    runId: json.data?.id,
    datasetId: json.data?.defaultDatasetId ?? null,
  };
}

export interface RunStatus {
  status: string; // READY | RUNNING | SUCCEEDED | FAILED | ABORTED | TIMED-OUT
  datasetId: string | null;
}

export async function getRun(runId: string): Promise<RunStatus> {
  const token = requireToken();
  const res = await fetch(`${APIFY_API}/actor-runs/${runId}?token=${token}`);
  if (!res.ok) throw new Error(`Apify run status failed: ${await res.text()}`);
  const json = await res.json();
  return {
    status: json.data?.status ?? "UNKNOWN",
    datasetId: json.data?.defaultDatasetId ?? null,
  };
}

export async function getDatasetItems(
  datasetId: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const token = requireToken();
  const res = await fetch(
    `${APIFY_API}/datasets/${datasetId}/items?token=${token}&clean=true&limit=${limit}`,
  );
  if (!res.ok) throw new Error(`Apify dataset fetch failed: ${await res.text()}`);
  return res.json();
}

export interface NormalizedProfile {
  full_name: string;
  headline: string | null;
  location: string | null;
  linkedin_url: string | null;
  about: string | null;
  raw_text: string;
  parsed: Record<string, unknown>;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function locationToString(loc: unknown): string | null {
  if (!loc) return null;
  if (typeof loc === "string") return loc;
  if (typeof loc === "object") {
    const o = loc as Record<string, unknown>;
    return (
      str(o.linkedinText) ??
      str(o.text) ??
      str((o.parsed as Record<string, unknown> | undefined)?.text) ??
      str(o.city) ??
      null
    );
  }
  return null;
}

/** Normalize an actor dataset item into our candidate shape. Defensive across actors. */
export function normalizeProfile(item: Record<string, unknown>): NormalizedProfile {
  const first = str(item.firstName);
  const last = str(item.lastName);
  const full_name =
    str(item.fullName) ??
    str(item.name) ??
    ([first, last].filter(Boolean).join(" ").trim() || "Unknown profile");

  const headline = str(item.headline) ?? str(item.title) ?? str(item.occupation);
  const location = locationToString(item.location) ?? str(item.locationName);
  const linkedin_url =
    str(item.linkedinUrl) ?? str(item.url) ?? str(item.profileUrl) ?? str(item.publicUrl);
  const about = str(item.about) ?? str(item.summary);

  // Assemble a readable text blob for AI scoring (like a CV).
  const parts: string[] = [];
  if (full_name) parts.push(full_name);
  if (headline) parts.push(headline);
  if (location) parts.push(`Location: ${location}`);
  if (about) parts.push(`\nAbout:\n${about}`);

  const experience = Array.isArray(item.experience) ? item.experience : [];
  if (experience.length) {
    parts.push("\nExperience:");
    for (const e of experience.slice(0, 15)) {
      const x = e as Record<string, unknown>;
      const title = str(x.position) ?? str(x.title) ?? str(x.role);
      const company = str(x.companyName) ?? str(x.company) ?? str(x.organisation);
      const period = str(x.duration) ?? str(x.dateRange) ?? str(x.period);
      const line = [title, company && `@ ${company}`, period && `(${period})`]
        .filter(Boolean)
        .join(" ");
      if (line) parts.push(`- ${line}`);
    }
  }

  const education = Array.isArray(item.education) ? item.education : [];
  if (education.length) {
    parts.push("\nEducation:");
    for (const ed of education.slice(0, 8)) {
      const x = ed as Record<string, unknown>;
      const school = str(x.schoolName) ?? str(x.school) ?? str(x.title);
      const degree = str(x.degree) ?? str(x.fieldOfStudy) ?? str(x.subtitle);
      const line = [school, degree && `— ${degree}`].filter(Boolean).join(" ");
      if (line) parts.push(`- ${line}`);
    }
  }

  const skills = Array.isArray(item.skills) ? item.skills : [];
  if (skills.length) {
    const names = skills
      .map((s) => (typeof s === "string" ? s : str((s as Record<string, unknown>).name)))
      .filter(Boolean);
    if (names.length) parts.push(`\nSkills: ${names.join(", ")}`);
  }

  return {
    full_name,
    headline,
    location,
    linkedin_url,
    about,
    raw_text: parts.join("\n"),
    parsed: {
      headline,
      location,
      linkedin_url,
      current_position: item.currentPosition ?? null,
      source: "linkedin",
    },
  };
}
