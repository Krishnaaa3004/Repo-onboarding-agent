import { Composition } from "remotion";
// Same fonts and design tokens as the live site, imported from the frontend itself.
import "@fontsource-variable/fraunces";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource-variable/jetbrains-mono";
import "../../frontend/src/styles/tokens.css";
import { Demo, TOTAL_FRAMES } from "./Demo";

export const RemotionRoot = () => (
  <Composition id="Demo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={30} width={1920} height={1080} />
);
