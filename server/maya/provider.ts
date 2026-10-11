import 'server-only';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  teachingPlanSchema,
  teachingPolicy,
  type LessonContext,
} from '@/features/maya/contracts';
import { buildMockPlan, validatePlan } from '@/features/maya/planner';

export const providerConfigSchema = z.strictObject({
  mode: z.enum(['mock', 'development_ai']).default('mock'),
  realtimeModel: z.enum(['gpt-realtime-2.1']).default('gpt-realtime-2.1'),
  planningModel: z.enum(['gpt-6-astra']).default('gpt-6-astra'),
  maxDurationSeconds: z.coerce.number().int().min(30).max(300).default(300),
  budgetCents: z.coerce.number().int().min(1).max(500).default(25),
  maxConcurrentSessions: z.literal(1).default(1),
  maxReconnects: z.literal(0).default(0),
  timeoutMs: z.coerce.number().int().min(1000).max(15000).default(10000),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export function readProviderConfig(
  env: Record<string, string | undefined> = process.env,
) {
  return providerConfigSchema.parse({
    mode: env.MAYA_PROVIDER,
    realtimeModel: env.MAYA_REALTIME_MODEL,
    planningModel: env.MAYA_PLANNING_MODEL,
    maxDurationSeconds: env.MAYA_MAX_DURATION_SECONDS,
    budgetCents: env.MAYA_BUDGET_CENTS,
    timeoutMs: env.MAYA_TIMEOUT_MS,
  });
}
export function assertLiveAuthorization(
  config: ProviderConfig,
  env: Record<string, string | undefined> = process.env,
): never {
  providerConfigSchema.parse(config);
  if (config.mode !== 'development_ai' || env.NODE_ENV !== 'development')
    throw new Error(
      'Live AI is disabled outside explicitly configured development.',
    );
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.startsWith('replace-'))
    throw new Error('Server-only OpenAI credentials are missing.');
  // This is intentionally not an env switch, role, cookie or parent consent.
  // No trusted developer capability issuer or enforceable provider spending cap
  // exists yet. A reviewed implementation must replace this fail-closed gate.
  throw new Error(
    'Live AI activation is blocked: trusted developer authorization and verified spending-cap enforcement require approval and implementation.',
  );
}
export interface TeachingProvider {
  readonly name: 'mock' | 'openai';
  plan(context: LessonContext): Promise<unknown>;
}
export class MockTeachingProvider implements TeachingProvider {
  readonly name = 'mock' as const;
  async plan(context: LessonContext) {
    return buildMockPlan(context);
  }
}
const proposalSchema = teachingPlanSchema.omit({ provenance: true });
export function realtimeConfiguration(
  config: ProviderConfig,
  instructions: string,
) {
  return {
    type: 'realtime' as const,
    model: config.realtimeModel,
    instructions,
    output_modalities: ['audio'] as ['audio'],
    max_output_tokens: 256,
    audio: {
      input: {
        turn_detection: {
          type: 'server_vad' as const,
          create_response: false,
          interrupt_response: true,
        },
      },
      output: { voice: 'marin' as const },
    },
    // No unrestricted provider tools. Reviewed server proposals need a separate
    // live producer; credentials are not a grant to mutate the lesson stream.
    tools: [],
  };
}
export class InactiveOpenAITeachingProvider implements TeachingProvider {
  readonly name = 'openai' as const;
  constructor(private readonly config: ProviderConfig = readProviderConfig()) {}
  private client() {
    assertLiveAuthorization(this.config);
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: this.config.timeoutMs,
      maxRetries: 0,
    });
  }
  async plan(context: LessonContext) {
    const client = this.client();
    // Future live context must be independently constructed from approved
    // synthetic/adult fixtures. Supervised child context is never sent out.
    if (context.mode === 'supervised_mock')
      throw new Error(
        'Supervised preview cannot authorize external disclosure.',
      );
    const response = await client.responses.parse({
      model: this.config.planningModel,
      store: false,
      max_output_tokens: 1500,
      input: [
        { role: 'system', content: JSON.stringify(teachingPolicy) },
        { role: 'user', content: JSON.stringify(context) },
      ],
      text: { format: zodTextFormat(proposalSchema, 'lesson_plan') },
    });
    if (!response.output_parsed)
      throw new Error('Planner refused or returned incomplete output.');
    const checked = validatePlan(
      {
        ...response.output_parsed,
        provenance: {
          provider: 'mock',
          plannerVersion: 'mock-planner-1',
          policyVersion: context.policyVersion,
          publicationReference: context.publicationReference,
        },
      },
      context,
    );
    return {
      ...checked,
      provenance: {
        provider: 'openai',
        model: this.config.planningModel,
        policyVersion: context.policyVersion,
        publicationReference: context.publicationReference,
      },
      usage: response.usage ?? null,
    };
  }
  async issueRealtimeCredential() {
    const client = this.client();
    // No route calls this method, and the gate above always denies activation.
    return client.realtime.clientSecrets.create({
      expires_after: { anchor: 'created_at', seconds: 60 },
      session: realtimeConfiguration(
        this.config,
        JSON.stringify(teachingPolicy),
      ),
    });
  }
}
export function createTeachingProvider(
  config: ProviderConfig = readProviderConfig(),
): TeachingProvider {
  if (config.mode === 'mock') return new MockTeachingProvider();
  assertLiveAuthorization(config);
}
