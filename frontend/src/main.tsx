import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./observability/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(<App />);
