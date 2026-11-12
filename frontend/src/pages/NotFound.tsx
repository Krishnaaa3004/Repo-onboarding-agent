import { Link } from "react-router-dom";
import { Compass } from "../components/Icons";
import { usePageTitle } from "../lib/hooks";

export default function NotFound() {
  usePageTitle("Off the map");
  return (
    <div className="page notfound blueprint">
      <div className="wrap notfound-inner">
        <Compass size={48} className="notfound-mark" />
        <p className="eyebrow">404 · uncharted</p>
        <h1 className="page-title">You've walked off the map.</h1>
        <p className="page-lede">There's nothing at this address. The way back is short.</p>
        <p className="notfound-actions">
          <Link className="btn btn-accent" to="/">Back to the start</Link>
          <Link className="btn btn-ghost" to="/examples">Browse examples</Link>
        </p>
      </div>
    </div>
  );
}
