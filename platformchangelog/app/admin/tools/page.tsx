import { getAllTools, getSuggestions, type Suggestion } from "@/lib/admin-queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/taxonomy";
import { addTool, dismissTerm, setTracked } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tools", robots: { index: false } };

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

function AddToolForm({ term }: { term?: string }) {
  const id = term ? `add-${term.replace(/[^a-z0-9]+/g, "-")}` : "add-new";
  return (
    <form action={addTool} className="add-tool">
      <div className="row">
        <label>Name<input id={`${id}-name`} name="name" defaultValue={term ? titleCase(term) : ""} required /></label>
        <label>Kind
          <select id={`${id}-kind`} name="kind" defaultValue="tool">
            <option value="tool">tool</option><option value="platform">platform</option><option value="mcp_server">MCP server</option>
            <option value="report">report</option><option value="standard">standard</option>
          </select>
        </label>
        <label>Category
          <select id={`${id}-category`} name="category" defaultValue="cicd">
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
      </div>
      <label>Description (one or two plain sentences, shown publicly)
        <input id={`${id}-description`} name="description" required />
      </label>
      <div className="row">
        <label>GitHub repo (owner/name, adds a release feed)<input id={`${id}-repo`} name="githubRepo" placeholder="argoproj/argo-cd" /></label>
        <label>Homepage<input id={`${id}-home`} name="homepageUrl" placeholder="https://" /></label>
        <label>Vendor (blank for foundation projects)<input id={`${id}-vendor`} name="vendor" /></label>
      </div>
      <p><button type="submit">Add and track</button> <span className="meta">It appears publicly once the next ingest finds a release, or once it has practical notes.</span></p>
    </form>
  );
}

function SuggestionRow({ s }: { s: Suggestion }) {
  return (
    <article className="item">
      <div className="meta">
        <span><b>{s.term}</b></span>
        <span>{s.searches} searches, {s.filters} filters</span>
        <span>last {s.last}</span>
      </div>
      {s.match?.kind === "untracked" && (
        <form action={setTracked} className="row" style={{ alignItems: "center" }}>
          <input type="hidden" name="slug" value={s.match.slug} />
          <input type="hidden" name="tracked" value="true" />
          <span>Known but untracked: <b>{s.match.name}</b></span>
          <button type="submit" style={{ flex: "0 0 auto" }}>Track again</button>
        </form>
      )}
      {s.match?.kind === "hidden" && (
        <p>Tracked as <b>{s.match.name}</b>, but not public yet: no release or notes so far.</p>
      )}
      {!s.match && (
        <details>
          <summary>Not in the registry. Add it</summary>
          <AddToolForm term={s.term} />
        </details>
      )}
      <form action={dismissTerm}>
        <input type="hidden" name="term" value={s.term} />
        <button type="submit">Dismiss, not a tool</button>
      </form>
    </article>
  );
}

export default async function Tools() {
  const [suggestions, tools] = await Promise.all([getSuggestions(), getAllTools()]);
  const tracked = tools.filter((t) => t.tracked);
  const known = tools.filter((t) => !t.tracked);

  return (
    <>
      <h1 style={{ fontSize: 22 }}>Tools</h1>

      <h2 style={{ fontSize: 18 }}>Searched for, not covered ({suggestions.length})</h2>
      <p className="meta">Searches and registry filters from the last 90 days that found no public tool, most frequent first.</p>
      {suggestions.length === 0 ? <p>Nothing yet.</p> : suggestions.map((s) => <SuggestionRow key={s.term} s={s} />)}

      <h2 style={{ fontSize: 18 }}>Tracked ({tracked.length})</h2>
      <ToolTable tools={tracked} action="untrack" />

      <h2 style={{ fontSize: 18 }}>Known, untracked ({known.length})</h2>
      <p className="meta">Kept in the registry database with their history, hidden from the site, feeds not fetched.</p>
      {known.length === 0 ? <p>None.</p> : <ToolTable tools={known} action="track" />}

      <h2 style={{ fontSize: 18 }}>Add a tool</h2>
      <AddToolForm />
    </>
  );
}

function ToolTable({ tools, action }: { tools: Awaited<ReturnType<typeof getAllTools>>; action: "track" | "untrack" }) {
  return (
    <table>
      <thead><tr><th>Tool</th><th>Public</th><th>Feeds</th><th>Releases</th><th>Last fetch</th><th></th></tr></thead>
      <tbody>
        {tools.map((t) => (
          <tr key={t.slug}>
            <td>
              {t.visible ? <a href={`/tools/${t.slug}`}>{t.name}</a> : t.name}
              <div className="meta">{t.kind}{t.category ? `, ${CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS] ?? t.category}` : ""}</div>
              {t.last_error && <div className="flags">{t.last_error}</div>}
            </td>
            <td>{t.visible ? "yes" : "no"}</td>
            <td>{t.active_sources}/{t.sources}</td>
            <td>{t.releases}</td>
            <td>{t.last_fetched ?? "never"}</td>
            <td>
              <form action={setTracked}>
                <input type="hidden" name="slug" value={t.slug} />
                <input type="hidden" name="tracked" value={action === "track" ? "true" : "false"} />
                <button type="submit">{action === "track" ? "Track" : "Untrack"}</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
