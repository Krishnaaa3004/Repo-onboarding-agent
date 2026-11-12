import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/wght-italic.css";
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
import PlanPage from "./pages/PlanPage";
import ExamplesPage from "./pages/ExamplesPage";
import AboutPage from "./pages/AboutPage";
import NotFound from "./pages/NotFound";

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/plan/:owner/:repo", element: <PlanPage /> },
      { path: "/examples", element: <ExamplesPage /> },
      { path: "/about", element: <AboutPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
