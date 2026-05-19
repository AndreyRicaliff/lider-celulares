import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

window.onerror = (msg, src, line, col, err) => {
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML = `<div style="color:#ff6b6b;padding:24px;font-family:monospace;font-size:13px;background:#0a0a0a;min-height:100vh"><h2 style="color:#ff6b6b;margin:0 0 12px">Erro ao inicializar</h2><pre style="white-space:pre-wrap;word-break:break-all">${msg}\n${src}:${line}:${col}\n\n${err?.stack || ''}</pre></div>`;
  }
};

createRoot(document.getElementById("root")!).render(<App />);
