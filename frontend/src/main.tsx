import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "@fontsource-variable/fraunces";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource-variable/jetbrains-mono";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/landing.css";
import "./styles/plan.css";
import "./styles/pages.css";

import App from "./App";
import Landing from "./pages/Landing";

// Landing is in the main bundle for a fast first paint; other pages load on demand.
const lazyPage = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/plan/:owner/:repo", lazy: lazyPage(() => import("./pages/PlanPage")) },
      { path: "/examples", lazy: lazyPage(() => import("./pages/ExamplesPage")) },
      { path: "/about", lazy: lazyPage(() => import("./pages/AboutPage")) },
      { path: "*", lazy: lazyPage(() => import("./pages/NotFound")) },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
