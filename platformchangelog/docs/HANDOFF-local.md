# Hand-off: run and test Platform Changelog locally

| | |
|---|---|
| Status | Code complete through commit `4995e99`; never run on CT's machine yet |
| Date | 2026-10-10 |
| Owner | CT |
| Audience | The Claude Code session on CT's machine picking this up |

Paste this as the first message in the local session.

---

You are picking up **Platform Changelog** (platformchangelog.dev): a vendor-neutral news feed and tool registry for platform engineering, developer experience and DevOps. It was built in a cloud session that could not reach GitHub's release feeds and cannot run anything on this machine. Your job is to get it running here, verify the parts the cloud session could not, and report back.

## Context to load first

- Load the `ct-context` skill. CT's Notion "CT Knowledge Base" is the source of truth about him; the project page is **CT Knowledge Base / Projects / Platform Changelog**. Read its callout, Decisions and the Log entries dated 2026-10-09 and 2026-10-10. Do not restate CT's context back to him.
- Repo: `absolutered03/sfdx-falcon`, branch **`ccr-8336bd6e-zbmdlb`**, folder **`platformchangelog/`** (self-contained; it only lives in this repo for now). Read `platformchangelog/README.md` first, then `docs/02-product-and-architecture.md` and `docs/04-editorial-rules.md` as needed.
- Stack: Next.js 16 (App Router, `proxy.ts` not middleware), TypeScript, Postgres + Drizzle (`drizzle-kit push`, no migrations), tsx scripts, GitHub Actions cron (planned), Railway (planned, not deployed).

## Run it

From `platformchangelog/`, with Docker Desktop running and Node 20+:

```bash
git pull origin ccr-8336bd6e-zbmdlb
npm run local
```

`scripts/local.sh` does everything: writes `.env` on first run (generated admin password), starts Postgres in Docker on host port **5433**, `npm ci`, `drizzle-kit push --force`, seed, ingest (no model calls), `rebuild:releases -- --refetch` (full release notes from the GitHub API, using the `gh` login if present), unit tests, build, start on **http://localhost:3000**. It prints the admin URL, user and password at the end.

- If `.env` already exists it is kept. If its `DATABASE_URL` points at a reachable Postgres, Docker is skipped.
- Fast restart: `npm run local -- --skip-fetch`. Hot reload: `npm run local -- --dev`.
- Model write-ups: `npm run local -- --summarize 10` needs `ANTHROPIC_API_KEY` in `.env`. **Ask CT before running it**: entries publish automatically (to the local database only) and the production model choice is still open.
- On Windows use WSL or Git Bash.

## Verify (the cloud session could not)

Report each with what you saw.

1. **Full release notes via the GitHub API.** The rebuild line should report no `GitHub API HTTP 403` errors. Open `/tools/kyverno#v1.19.0`: it should show about **238** typed lines (the cloud test data had only 133, cut at 12,000 characters). Compare against https://github.com/kyverno/kyverno/releases/tag/v1.19.0.
2. **Typing quality.** Skim three tools with different note styles: Kyverno (GitHub generated notes), Open Policy Agent (component prefixes like `Ast: Fix ...`), Helm or Argo CD. Note obviously wrong types. About 7% "other" is expected; prose-style notes (ServiceNow SDK) land mostly in other.
3. **Salesforce CLI.** `/tools/salesforce-cli` should show current **2.153.5** (or the latest stable on Wednesdays), typed NEW / CHANGE / FIX lines from `forcedotcom/cli` release notes, and no nightly builds.
4. **The tmux-style UI** (ported from `design/prototype-v1/`): workspaces `1` `2` `3`, `/` opens the launcher search (try `kyverno 1.19` and `cve-2026`), `j` / `k` move through tools, `t` cycles palettes, the light/dark toggle sticks across reloads, no horizontal scroll at phone width.
5. **Admin** at `/admin` (basic auth from `.env`): Audit, Insights, Tools tabs render; a search that finds nothing shows up under Tools > "Searched for, not covered" after a reload.
6. `npm test` and `npm run typecheck` pass.

## Standing rules (do not break)

- **Feed items publish without human review** (CT's project decision, 2026-10-09, this project only). Safeguards that must stay: the model never awards Major (auto entries are notable); deterministic publish checks hold bad output; `/admin` is the after-the-fact audit. Practical notes on tool pages stay human-written. CT's global human-in-the-loop rule is unchanged everywhere else.
- **No em dashes or en dashes** in anything CT sends or publishes, including site copy. Hyphens are fine.
- **Do not work around bot protection** (Salesforce Developers Blog is disabled on purpose; Akamai blocks automated clients).
- **CT's Claude subscription is for evaluation only**, never for site content. The site uses an API key.
- **Git:** work on `ccr-8336bd6e-zbmdlb`. Do not push to `main`, do not open a PR unless CT asks. Commit messages end with the session's attribution lines. Never commit `.env`.
- **Notion:** append dated lines to the project page; never overwrite existing lines. If something contradicts the page, show CT both.

## Known state and caveats

- Nothing is deployed. platformchangelog.dev is bought, not pointed anywhere.
- The feed shows releases even with no model calls; summaries only appear after `--summarize` (or a real ingest with an API key).
- Tools added in `/admin/tools` live in the database only, not in `data/entities.json`.
- `NODE_USE_ENV_PROXY=1` appears in old notes; it was a cloud-sandbox workaround and is not needed here.
- Rate limit on `/api/events` is per process (fine for one server).

## Open decisions (CT's call; do not decide them)

- Production model: Haiku 5.5 was recommended from the 2026-10-08 evals (`docs/evals/`). Defaults in `.env.example` are still `claude-opus-5-5`.
- Whether to add a Kubernetes core category (cgroup v2 style posts fit none of the seven).
- Newsletter ingestion for sources that block automated clients.
- Moving `platformchangelog/` into its own repo, then Railway deploy (steps in `docs/03-first-week-plan.md`).

## How to resume

1. `git pull`, `npm run local`, wait for the URL.
2. Run the six checks above; screenshot anything odd.
3. Report to CT: what passed, what failed with the exact output, and any parser mistypes worth fixing.
4. Fix only what CT asks for; validate with `npm test`, `npm run typecheck` and `npm run build` before committing.
5. Append a dated line to the Notion project page summarizing the local verification.
