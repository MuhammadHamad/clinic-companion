import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

document.documentElement.classList.add("theme-glass");
document.documentElement.classList.remove("theme-neo", "theme-luxe");

try {
  const storedMode = localStorage.getItem("color-mode");
  if (storedMode === "dark") document.documentElement.classList.add("dark");
  if (storedMode === "light") document.documentElement.classList.remove("dark");
} catch {
  // ignore
}

createRoot(document.getElementById("root")!).render(<App />);
