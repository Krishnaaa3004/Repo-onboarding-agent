import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ScrollRestoration, useLocation, useOutlet } from "react-router-dom";
import { SiteFooter } from "./components/SiteFooter";
import { SiteHeader } from "./components/SiteHeader";
import { API_URL } from "./useOnboarding";
import { useEffect } from "react";

/** Layout shell: header, animated page outlet, footer. */
export default function App() {
  const location = useLocation();
  const outlet = useOutlet();
  // plan pages for different repos are different pages; query changes are not
  const key = location.pathname;

  // The free backend sleeps when idle and takes ~30s to wake. Ping it once on load so it is
  // usually awake by the time someone has typed a repo. Failures are ignored on purpose.
  useEffect(() => {
    fetch(`${API_URL}/api/health`, { mode: "cors" }).catch(() => {});
  }, []);

  return (
    // reducedMotion="user": Framer skips transform animations when the OS asks for reduced motion
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  );
}
