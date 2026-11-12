import { EXAMPLES } from "../lib/examples";
import { usePageTitle } from "../lib/hooks";
import { SheetCard } from "./Landing";

export default function ExamplesPage() {
  usePageTitle("Examples");
  return (
    <div className="page">
      <header className="page-head blueprint">
        <div className="wrap">
          <p className="eyebrow">Examples</p>
          <h1 className="page-title">Repos the agent has already mapped.</h1>
          <p className="page-lede">
            Each plan below came from a real run of the agent and was saved as a file in this site. They open
            instantly and work even if Gemini is down or the daily quota is used up. Use “Run live” on any plan to
            watch the agent build it again from scratch.
          </p>
        </div>
      </header>
      <div className="wrap page-body">
        <ul className="sheets sheets-flat">
          {EXAMPLES.map((ex, i) => <SheetCard key={ex.slug} ex={ex} index={i} />)}
        </ul>
        <p className="page-note">
          Profile used for these plans: knows Python, beginner. Issue picks and scores change with the profile you
          choose on the home page.
        </p>
      </div>
    </div>
  );
}
