export const metadata = { title: "Methodology" };

// Keep this page in step with docs/04-editorial-rules.md. It is the public contract.
export default function About() {
  return (
    <>
      <h1 style={{ fontSize: 22 }}>How Platform Changelog works</h1>
      <p>
        Platform Changelog tracks what ships in platform engineering, developer experience and DevOps, and says in plain
        English what it changes for the team that runs the platform. It is vendor-neutral and not affiliated with any
        project or company it covers.
      </p>

      <h2 style={{ fontSize: 18 }}>Where entries come from</h2>
      <p>
        Only from an allow-list of public sources: project release feeds on GitHub, foundation and project blogs, a small
        number of trade publications, and items an editor adds by hand. We do not accept submitted press releases as
        sources. Every entry links to its original.
      </p>

      <h2 style={{ fontSize: 18 }}>What software does, and what a person does</h2>
      <p>
        Software fetches the sources, discards obvious noise (pre-releases, chart tags, off-topic posts) and drafts a short
        summary and tags with a language model. A person reads every draft against the source, edits or rejects it, and only
        then is it published. Routine patch releases are listed on a tool's page as a version, date and link, with no
        generated text.
      </p>

      <h2 style={{ fontSize: 18 }}>Impact tags</h2>
      <p>
        <b>Major</b> means a breaking change, a security fix, a capability platform teams will plan around, or a report with
        new primary data. Everything else that clears the bar is <b>notable</b>. A vendor&apos;s claims about its own product
        are reported as claims, and a vendor announcement on its own is never tagged major.
      </p>

      <h2 style={{ fontSize: 18 }}>Sponsorship</h2>
      <p>
        Sponsored placements, when they exist, are labelled Sponsored, are visually separate from entries, and never carry
        an impact tag. Sponsors cannot buy, edit or veto coverage, and a sponsor&apos;s placement never appears on the page of a
        product it sells or competes with.
      </p>

      <h2 style={{ fontSize: 18 }}>Corrections</h2>
      <p>If we got something wrong, tell us and we will fix it and note the correction on the entry.</p>
    </>
  );
}
