# Agent entrypoint

Before non-mechanical work in `mayf3/dsh-agent-core`:

1. read `.agents/README.md` (vendored shared grammar);
2. read `.agents/local/README.md` (this repository's authority and constraints);
3. read the directly relevant Product Architecture, current Decisions, and accepted governing Specs;
4. read `.agents/skills/spec-governance/SKILL.md` and only the selected mode file.

Do not implement non-mechanical behavior unless an accepted implementation-authorizing Spec is already present in the implementation PR base.

Do not treat code, tests, runtime state, chat history, the newest-looking document, or an unmerged accepted-looking branch as higher authority than the repository's accepted local authorities.

When authority conflicts or drift are found, stop and report them. Do not silently choose a side or rewrite accepted meaning under the same stable ID.
