# T-034 · The agent layer: guess the tools, ask what the tool needs, run on the cheapest model, keep the context

status:     open
priority:   high
subsystem:  agent (new), story, lib

## The user's request (2026-10-31)

> another subsystem to sort into tool use, the big one is obviously the long form video generation, but also natural
> language back and forth to deal with simpler things, and for that pipeline the simplest thing will be having a model
> guess the tools needed and then based on tool ask the appropriate questions. Ticket should also include going to
> cheaper models if possible.

what:
A new subsystem, `src/agent/`, in front of everything. The film chain (`pipeline.mjs`), the podcast (T-032) and the
small jobs (T-033) are tools it calls; it owns the conversation and the session.

1. **The session**, `sessions/<id>/session.json`: the messages, the assets produced (file, job, the tool and inputs
   that made it), the run labels started, the brief sheet so far (T-030), the credits spent. Resumable like a run.
2. **Guess the tools.** One small text call per message with the catalogue (the tool definitions of T-033 plus
   `film`, `podcast`, `edit-run` for a change to an existing run): which tools, in what order, with what the message
   already supplies, and which asset in the session it refers to ("make it darker" is the last image; "the ending" is
   the last run's final shots). Low effort model; the catalogue is the prompt.
3. **Ask what the tool needs.** From the tool's question list (T-033) or the brief sheet (T-030): the missing fields
   become at most a few questions in one message, specific to the request, with the default named for anything the
   user may skip. No question for what the message or the session already answers. The archived
   `clarificationSlots.ts` is the ancestor: its slots (output type, subject, duration, format, speech mode) fold into
   the sheet.
4. **Run.** The tool runs through `lib/jobs.js`; before any paid work the agent states the estimate from the
   registry's costs and the cap, and waits for a yes on anything above a threshold (default 500 credits). The film
   tool is `pipeline.mjs` with the sheet as answers; a change to a run is `--retry` / `--only` on the named stills and
   clips so the rest is cached and unpaid.
5. **Cheaper models.** The tier is `free` by default; the agent moves up only when the request needs what the free
   model lacks (a resolution, references, a length), when a gate has failed twice on the free model, or when the user
   asks; each move is said and costed. Text calls use the smallest model that passes the benchmark; the agent's own
   guess call is the cheapest of all.
6. **Show and continue.** Every result comes back with its page or file, what it cost, and what can be changed; the
   next message edits it. The agent never remakes what the message did not name.
7. **Surface.** A terminal loop first (`node V2/src/agent/agent.mjs` reads a line, answers, loops); the same functions
   behind an HTTP route later for the chat workspace in `archived/frontend`.

why:
The feedback of 2026-10-31: no conversation, no tool calling, no multi-turn editing with retained context, and the
cost of the paid models. The original repo had the pieces (clarification slots, a capability catalogue, follow-up
messages and timeline edits); V2 rebuilt the film chain and left them out. The run record already is a resumable,
cached session for one film; this makes a session hold many assets and many runs.

acceptance:
The benchmark's conversation cases pass (T-031: `ask-first`, `follow-up`, and the five small jobs of T-033); the two
film briefs still route to the film tool and produce the same output as `pipeline.mjs` with the same answers; a
transcript in `V2/drafts/` of one session that makes an image, edits it, swaps a face, then starts an ad, with the
credits per step, all on the free tier. Text calls only until a tool runs.
