import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import demoDataset from "virtual:demo-data"
import { App } from "./App.js"
import { createStaticDemoClient } from "./demo-client.js"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("Application root is missing")

const client = createStaticDemoClient(demoDataset, import.meta.env.BASE_URL)
createRoot(root).render(
  <StrictMode>
    <App client={client} mode="demo" initialPresentation={demoDataset.presentation} />
  </StrictMode>,
)
