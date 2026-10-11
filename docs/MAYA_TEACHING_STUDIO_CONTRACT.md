# Future Maya Teaching Studio contract

Curriculum Studio defines **what** is taught. Maya Teaching Studio will define **how** approved academic content is taught. Academic documents contain facts, objectives, demonstrations, examples, mistakes, practice prompts, and resource references. They contain no global system prompt or private answer key.

## Configuration layers

| Layer                  | Future versioned configuration                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Global teaching policy | Philosophy, communication standards, questioning, pacing, encouragement, feedback, exemplar teaching interactions, relationship boundaries |
| Subject strategy       | Mathematics explanation methods, assessment approaches, balance/number-line demonstrations, synchronized narration/whiteboard techniques   |
| Chapter guidance       | Published topic objectives, worked examples, misconceptions, recommended demonstration sequences and reviewed pedagogical guidance         |
| Student adaptation     | Authorized relevant mastery, misconceptions, prior evidence/session references, and useful instructional preferences                       |
| Mandatory controls     | Independently governed safety policy, eligibility/consent decisions, authorization, tool permissions, and moderation constraints           |

Safety boundaries can be displayed in the Studio but cannot be weakened by editable pedagogy. Configuration is data: no arbitrary executable tools, database operations, or unrestricted system instructions. Student adaptation must use traceable academic evidence; no psychological, attention, or facial-emotion profiling.

## Versions and activation

Future teaching policies should have stable identity, monotonic version, scope, structured schema version, draft/published state, author/reviewer, and publication/activation audit records. Published policies are immutable. Test candidate policies against deterministic teaching examples, assessment expectations, safety cases, and narration/whiteboard alignment before activation. Activation is a separate controlled decision, with a pilot feature flag and reviewed scope. Rollback selects a previously approved publication for future sessions; active sessions and historical AI runs retain their exact policy references. This requires reviewed atomic activation/session pinning, not replacing mutable prompt text.

## Lesson Context Package

The conceptual TypeScript contract is in `features/curriculum/contracts.ts`. A future planner must produce and runtime-validate a bounded package containing:

- Authorized student and lesson references plus an authorization decision reference.
- Exact published curriculum version and selected topic/target skill definitions.
- Structured academic content and prerequisite readiness from that version.
- Exact published global/subject teaching-policy references.
- Relevant evidence references and permissible instructional preferences.
- Independently verified safety-policy version and capability decisions.

Before any LLM call, deterministic services must validate package membership, published state, student ownership, enrollment pin, evidence scope, policy activation, capability eligibility, consent, and resource access. Static TypeScript contracts alone are not runtime authorization. Safety/authorization controls take precedence over every editable instruction; conflicts must fail validation or use a reviewed safe fallback. The planner should retrieve only relevant context, not complete transcripts or all student memory.

The future tutor can propose teaching actions and whiteboard commands within validated tool schemas. Scheduling, assessment, evidence, and mastery services retain deterministic write authority. Private assessment answers are fetched only by authorized assessment services and must not be sent to the explorer or included in general public content. AI runs record curriculum, teaching-policy, safety-policy, and tool-schema versions with operational metadata, not sensitive prompt contents.

No policy tables, editing UI, model training/fine-tuning, AI calls, realtime audio, media collection, activation system, or session planner is implemented in Phase 2. The next curriculum consumer is Phase 3 course planning; Maya integration remains a later phase.

**Phase 6 follow-up:** [Maya integration](MAYA_INTEGRATION.md) now supplies a durable deterministic teaching simulation, validated context/plans/tools, rendered Maya commands and interruption/recovery on the canonical lesson timeline. Live OpenAI/WebRTC adapters remain inactive; approved developer authorization and spending controls are prerequisites. The preceding description records the earlier phase baseline.
