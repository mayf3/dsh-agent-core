# Agent entrypoint

Before non-mechanical work in `mayf3/dsh-agent-core`:

1. read `.agents/README.md` (vendored shared grammar);
2. read `.agents/local/README.md` (this repository's authority and constraints);
3. read the directly relevant Product Architecture, current Decisions, and accepted governing Specs;
4. read `.agents/skills/spec-governance/SKILL.md` and only the selected mode file.

For `REUSE`, implement within the existing accepted implementation-authorizing
Contracts in the base; an in-contract bug fix needs no new Spec. A bounded
`AMEND/NEW + ROUTINE/DURABLE` may combine its Spec delta and code only under the
active local permission described in `.agents/local/README.md`. `CONTROLLED`
changes and every `SUPERSEDE` remain docs-first. A proposed adoption branch does
not activate that permission or authorize product implementation.

Do not treat code, tests, runtime state, chat history, the newest-looking document, or an unmerged accepted-looking branch as higher authority than the repository's accepted local authorities.

When authority conflicts or drift are found, stop the dependent work and report the concrete conflict; unrelated authorized work may continue. Do not silently choose a side or rewrite accepted meaning under the same stable ID.
