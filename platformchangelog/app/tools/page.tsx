import Link from "next/link";
import { Pane } from "@/components/shell/Pane";
import { ToolList } from "@/components/ToolList";
import { getToolPane } from "@/lib/registry-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registry" };

export default async function Registry() {
  const { list, tools, groups } = await getToolPane();
  return (
    <div className="ws ws-registry overview">
      <section className="pane p-tools">
        <div className="ph"><span className="pt">tools</span><span className="pn">{tools.length}</span><span className="sp" /><span className="hint"><kbd>j</kbd> <kbd>k</kbd> move <kbd>f</kbd> filter</span></div>
        <ToolList tools={tools} groups={groups} />
      </section>
      <Pane title="registry" count={`${list.length} tools`} className="p-over" right={<span className="pn">current version is the highest release seen</span>}>
        <div className="th"><p className="sans">Tools, platforms, MCP servers and recurring reports we track, each with its release history typed line by line, alternatives and case notes. A tool appears once it has something to show.</p></div>
        <table className="overview-t">
          <thead><tr><th>tool</th><th>what it is</th><th>current</th></tr></thead>
          <tbody>
            {groups.map(([cat, label]) => [
              <tr key={cat}><td colSpan={3} className="grp" style={{ border: 0 }}>{label}</td></tr>,
              ...list.filter((e) => (e.categories[0] ?? "reports") === cat).map((e) => (
                <tr key={e.slug} data-entity={e.slug}>
                  <td><Link href={`/tools/${e.slug}`}>{e.name}</Link></td>
                  <td className="d">{e.description}</td>
                  <td className="v">{e.current ? <>{e.current.version}<div className="d" style={{ color: "var(--mute)", fontSize: 11 }}>{e.current.publishedAt.toISOString().slice(0, 10)}</div></> : <span style={{ color: "var(--mute)" }}>{e.license === "commercial" ? "SaaS" : "n/a"}</span>}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </Pane>
    </div>
  );
}
