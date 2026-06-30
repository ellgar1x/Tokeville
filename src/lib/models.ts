/**
 * Central model registry. Each provider has a list of models with metadata.
 * The `provider` field maps to the `provider_api_keys.provider` column and
 * to the string passed to `use_tokens` RPC.
 */

export type ProviderKey = "anthropic" | "openai" | "google" | "custom";

export interface ModelDef {
  id: string;
  /** Actual API model ID — defaults to `id` when absent. Used for virtual entries like "claude-code". */
  apiModelId?: string;
  /** Default system prompt injected for this model variant. */
  systemPrompt?: string;
  label: string;
  description: string;
  contextK: number;
  outputK: number;
  inputPer1M: number;
  outputPer1M: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  /** Badge shown in the workspace selector (e.g. "Code", "Reasoning") */
  badge?: string;
}

export interface ProviderDef {
  key: ProviderKey;
  label: string;
  color: string;
  models: ModelDef[];
}

const CODE_PROMPT = `You are an expert software engineering assistant. Help with code generation, debugging, architecture decisions, code review, and technical explanations. Write clean, well-structured code with brief comments where needed. Default to the user's language/framework; ask only when truly ambiguous.`;

const ANALYSIS_PROMPT = `You are an expert data and business analyst. Help with data interpretation, metrics, dashboards, SQL queries, spreadsheet formulas, and strategic insights. Be precise with numbers, flag assumptions, and structure answers clearly.`;

export const PROVIDERS: ProviderDef[] = [
  {
    key: "anthropic",
    label: "Anthropic",
    color: "#cc785c",
    models: [
      {
        id: "claude-opus-4-8",
        label: "Claude Opus 4.8",
        description: "Most capable. Complex reasoning, research, long docs.",
        contextK: 200,
        outputK: 32,
        inputPer1M: 15,
        outputPer1M: 75,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        description: "Balanced speed + intelligence for most tasks.",
        contextK: 200,
        outputK: 64,
        inputPer1M: 3,
        outputPer1M: 15,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "claude-haiku-4-5",
        apiModelId: "claude-haiku-4-5-20251001",
        label: "Claude Haiku 4.5",
        description: "Fastest Claude. Great for high-volume, low-latency work.",
        contextK: 200,
        outputK: 8,
        inputPer1M: 0.8,
        outputPer1M: 4,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "claude-code",
        apiModelId: "claude-sonnet-4-6",
        systemPrompt: CODE_PROMPT,
        label: "Claude Code",
        description: "Claude Sonnet 4.6 tuned for code — generation, debugging, architecture & review.",
        contextK: 200,
        outputK: 64,
        inputPer1M: 3,
        outputPer1M: 15,
        supportsTools: true,
        supportsVision: true,
        badge: "Code",
      },
      {
        id: "claude-analysis",
        apiModelId: "claude-opus-4-8",
        systemPrompt: ANALYSIS_PROMPT,
        label: "Claude Analysis",
        description: "Claude Opus 4.8 tuned for data analysis, metrics, SQL & business intelligence.",
        contextK: 200,
        outputK: 32,
        inputPer1M: 15,
        outputPer1M: 75,
        supportsTools: true,
        supportsVision: true,
        badge: "Analysis",
      },
      {
        id: "claude-3-5-sonnet-20241022",
        label: "Claude 3.5 Sonnet",
        description: "Previous-gen workhorse. Excellent code + analysis.",
        contextK: 200,
        outputK: 8,
        inputPer1M: 3,
        outputPer1M: 15,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "claude-3-opus-20240229",
        label: "Claude 3 Opus",
        description: "Previous top-tier. Deep reasoning, nuanced writing.",
        contextK: 200,
        outputK: 4,
        inputPer1M: 15,
        outputPer1M: 75,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "claude-3-haiku-20240307",
        label: "Claude 3 Haiku",
        description: "Previous fast tier. Cost-efficient for simple tasks.",
        contextK: 200,
        outputK: 4,
        inputPer1M: 0.25,
        outputPer1M: 1.25,
        supportsTools: true,
        supportsVision: true,
      },
    ],
  },
  {
    key: "openai",
    label: "OpenAI",
    color: "#10a37f",
    models: [
      {
        id: "gpt-4o",
        label: "GPT-4o",
        description: "OpenAI flagship. Multimodal, fast, highly capable.",
        contextK: 128,
        outputK: 16,
        inputPer1M: 2.5,
        outputPer1M: 10,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "gpt-4o-mini",
        label: "GPT-4o Mini",
        description: "Small, fast, cheap. Great for classification & extraction.",
        contextK: 128,
        outputK: 16,
        inputPer1M: 0.15,
        outputPer1M: 0.6,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "gpt-code",
        apiModelId: "gpt-4o",
        systemPrompt: CODE_PROMPT,
        label: "GPT-4o Code",
        description: "GPT-4o tuned for code generation, debugging, and architecture.",
        contextK: 128,
        outputK: 16,
        inputPer1M: 2.5,
        outputPer1M: 10,
        supportsTools: true,
        supportsVision: true,
        badge: "Code",
      },
      {
        id: "o3-mini",
        label: "o3 Mini",
        description: "Latest reasoning, lowest cost. Strong coding performance.",
        contextK: 200,
        outputK: 100,
        inputPer1M: 1.1,
        outputPer1M: 4.4,
        supportsTools: true,
        supportsVision: false,
        badge: "Reasoning",
      },
      {
        id: "o3",
        label: "o3",
        description: "Most powerful reasoning model. Frontier-level math/science.",
        contextK: 200,
        outputK: 100,
        inputPer1M: 10,
        outputPer1M: 40,
        supportsTools: true,
        supportsVision: true,
        badge: "Reasoning",
      },
      {
        id: "o1",
        label: "o1",
        description: "Reasoning model. Chain-of-thought for hard problems.",
        contextK: 200,
        outputK: 100,
        inputPer1M: 15,
        outputPer1M: 60,
        supportsTools: true,
        supportsVision: true,
        badge: "Reasoning",
      },
      {
        id: "o1-mini",
        label: "o1 Mini",
        description: "Faster, cheaper reasoning. STEM & code focus.",
        contextK: 128,
        outputK: 65,
        inputPer1M: 1.1,
        outputPer1M: 4.4,
        supportsTools: false,
        supportsVision: false,
        badge: "Reasoning",
      },
      {
        id: "gpt-4-turbo",
        label: "GPT-4 Turbo",
        description: "Previous GPT-4 flagship. 128K context.",
        contextK: 128,
        outputK: 4,
        inputPer1M: 10,
        outputPer1M: 30,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "gpt-3.5-turbo",
        label: "GPT-3.5 Turbo",
        description: "Legacy fast model. Very low cost, 16K context.",
        contextK: 16,
        outputK: 4,
        inputPer1M: 0.5,
        outputPer1M: 1.5,
        supportsTools: true,
        supportsVision: false,
      },
    ],
  },
  {
    key: "google",
    label: "Google",
    color: "#4285f4",
    models: [
      {
        id: "gemini-2.0-flash",
        label: "Gemini 2.0 Flash",
        description: "Fast, capable multimodal. Default choice for Google.",
        contextK: 1000,
        outputK: 8,
        inputPer1M: 0.1,
        outputPer1M: 0.4,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "gemini-code",
        apiModelId: "gemini-2.0-flash",
        systemPrompt: CODE_PROMPT,
        label: "Gemini Code",
        description: "Code generation and debugging powered by Gemini 2.0 Flash.",
        contextK: 1000,
        outputK: 8,
        inputPer1M: 0.1,
        outputPer1M: 0.4,
        supportsTools: true,
        supportsVision: true,
        badge: "Code",
      },
      {
        id: "gemini-2.0-flash-lite",
        label: "Gemini 2.0 Flash-Lite",
        description: "Cheapest Gemini. High throughput, low latency.",
        contextK: 1000,
        outputK: 8,
        inputPer1M: 0.075,
        outputPer1M: 0.3,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "gemini-1.5-pro",
        label: "Gemini 1.5 Pro",
        description: "1M context window. Long-doc summarization & analysis.",
        contextK: 1000,
        outputK: 8,
        inputPer1M: 1.25,
        outputPer1M: 5,
        supportsTools: true,
        supportsVision: true,
      },
      {
        id: "gemini-1.5-flash",
        label: "Gemini 1.5 Flash",
        description: "Efficient multimodal. Fast & affordable.",
        contextK: 1000,
        outputK: 8,
        inputPer1M: 0.075,
        outputPer1M: 0.3,
        supportsTools: true,
        supportsVision: true,
      },
    ],
  },
];

export function getProvider(key: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.key === key);
}

export function findModel(modelId: string): { provider: ProviderDef; model: ModelDef } | undefined {
  for (const p of PROVIDERS) {
    const m = p.models.find((m) => m.id === modelId);
    if (m) return { provider: p, model: m };
  }
  return undefined;
}
