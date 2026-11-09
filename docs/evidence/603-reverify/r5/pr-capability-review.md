# R5 PR head capability preflight

Independent read-only reviewer `/root/r5_pr_capability` checked installed `gh 2.100.0` and official documentation. No edit command or remote write was performed during this preflight.

- Installed `gh pr edit --help` contains `--base`, not `--head`.
- Official CLI manual: https://cli.github.com/manual/gh_pr_edit
- REST Update PR fields: `title/body/state/base/maintainer_can_modify`, no `head`: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#update-a-pull-request
- GraphQL `UpdatePullRequestInput` has `baseRefName`, no `headRefName`; creation has the latter: https://docs.github.com/en/graphql/reference/pulls#updatepullrequestinput
- `update-branch` merges base into the existing head; it does not replace the head: https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28#update-a-pull-request-branch

The Owner-specified command is authorized but unsupported. Preserve its actual execution result at step 3; do not substitute `--base`, force-push the historical branch, close PR603, or create another PR. No successful PR-head change is claimed by this preflight.
