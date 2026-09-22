import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App.js"
import { httpReaderClient } from "./api.js"
import "./styles.css"

const root = document.getElementById("root")
if (!root) {
  throw new Error("Application root is missing")
}

createRoot(root).render(
  <StrictMode>
    <App client={httpReaderClient} mode="reader" />
  </StrictMode>,
)
