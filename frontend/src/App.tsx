import { AnimatePresence, motion } from "framer-motion";
import { ScrollRestoration, useLocation, useOutlet } from "react-router-dom";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";

/** Layout shell: header, animated page outlet, footer. */
export default function App() {
  const location = useLocation();
  const outlet = useOutlet();
  // plan pages for different repos are different pages; query changes are not
  const key = location.pathname;

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <SiteHeader />
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          id="main"
          key={key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
      <SiteFooter />
      {/* keyed by URL: every fresh page load shares the key "default", which would restore the wrong position */}
      <ScrollRestoration getKey={(loc) => loc.pathname + loc.search} />
    </>
  );
}
