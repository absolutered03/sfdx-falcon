import { Pane } from "@/components/shell/Pane";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata = { title: "Methodology" };

// Keep this page in step with docs/04-editorial-rules.md. It is the public contract.
export default function About() {
  return (
    <div className="ws ws-doc">
      <Pane title="methodology" right={<span className="pn">how an entry is made</span>}>
        <div className="pbp">
          <div className="doc sans">
            <h2>What this is</h2>
            <p>
              Platform Changelog tracks what ships in platform engineering, developer experience and DevOps, and says in plain
              English what it changes for the team that runs the platform. It is vendor-neutral and not affiliated with any
              project or company it covers.
            </p>
            <h2>Pipeline</h2>
            <div className="flow"><span>allow-listed sources</span><i>&rarr;</i><span>release notes</span><i>&rarr;</i><span>typed change lines</span><i>&rarr;</i><span>summary</span><i>&rarr;</i><span>checks</span><i>&rarr;</i><span className="on">published</span><i>&rarr;</i><span>audit</span></div>
            <p>
              Entries come only from an allow-list of public sources: project release notes, foundation and project blogs, a
              small number of trade publications, and items an editor adds by hand. We do not accept submitted press releases.
              Every entry links to its original.
            </p>
            <h2>What software does, and what a person does</h2>
            <p>
              Software fetches the sources and discards noise: pre-releases, nightly builds, chart tags, off-topic posts, and
              releases whose notes contain only dependency bumps, CI or docs changes. Every line of a release&apos;s notes is
              sorted into a change type by fixed rules, so the change lists on tool pages are the project&apos;s own words. A
              language model then writes a short summary and a line for platform teams.
            </p>
            <p>
              Entries are published automatically, without an editor reading them first. Before anything goes live, fixed
              rules hold back any entry with a missing source link, runaway length, markup or hype vocabulary. An editor reads
              the feed after publication and corrects or removes mistakes. Practical notes on tool pages are written by a
              person, never by the model.
            </p>
            <h2>Change types</h2>
            <p>
              The vocabulary is Keep a Changelog with one flag. A line is <code>added</code>, <code>changed</code>,{" "}
              <code>deprecated</code>, <code>removed</code>, <code>fixed</code> or <code>security</code>, plus{" "}
              <code>maintenance</code> for dependency, CI, test and docs lines and <code>other</code> when the notes give no
              signal. Any line can carry the <code>breaking</code> flag, shown as the <code>!</code> in the first column.
            </p>
            <h2>Impact tags</h2>
            <p>
              <b>Major</b> means a breaking change, a security fix in the tool itself, a capability platform teams will plan
              around, or a report with new primary data. Only an editor tags an entry major; everything published automatically
              is <b>notable</b>. A vendor&apos;s claims about its own product are reported as claims.
            </p>
            <h2>Sponsorship</h2>
            <p>
              Sponsored placements, when they exist, are labelled, visually separate from entries, and never carry an impact
              tag. Sponsors cannot buy, edit or veto coverage, and never appear on the page of a product they sell or compete with.
            </p>
            <h2>Corrections</h2>
            <p>
              If we got something wrong, write to <code>{CONTACT_EMAIL}</code> and we will fix it and note the correction on
              the entry. Tips on public postmortems and case studies go to the same address.
            </p>
          </div>
        </div>
      </Pane>
      <Pane title="data model" right={<span className="pn">one release, as stored</span>}>
        <pre className="code">
          <span className="c"># release notes are typed by code; the summary by a model</span>{"\n"}
          tool:     <span className="s">&quot;kyverno&quot;</span>{"\n"}
          version:  <span className="s">&quot;v1.19.0&quot;</span>{"\n"}
          date:     <span className="s">&quot;2026-08-20&quot;</span>{"\n"}
          kind:     <span className="s">&quot;minor&quot;</span>        <span className="c"># from the previous version</span>{"\n"}
          source:   <span className="s">&quot;https://github.com/kyverno/kyverno/releases/tag/v1.19.0&quot;</span>{"\n"}
          status:   <span className="s">&quot;published&quot;</span>    <span className="c"># queued | published | held | logged</span>{"\n"}
          changes:{"\n"}
          {"  "}- <span className="k">type</span>: <span className="s">security</span>{"\n"}
          {"    "}<span className="k">text</span>: <span className="s">&quot;Limit intermediate certs to mitigate CVE-2026-32280&quot;</span>{"\n"}
          {"  "}- <span className="k">type</span>: <span className="s">added</span>{"\n"}
          {"    "}<span className="k">text</span>: <span className="s">&quot;Add updaterequest total gauge metric&quot;</span>{"\n"}
          {"  "}- <span className="k">type</span>: <span className="s">maintenance</span>{"\n"}
          {"    "}<span className="k">text</span>: <span className="s">&quot;Bump github.com/rs/zerolog from 1.35.0 to 1.35.1&quot;</span>{"\n"}
          {"\n"}
          <span className="c"># types</span>{"\n"}
          added | changed | deprecated | removed | fixed | security{"\n"}
          maintenance | other{"\n"}
          <span className="c"># flags</span>{"\n"}
          breaking: bool
        </pre>
      </Pane>
    </div>
  );
}
