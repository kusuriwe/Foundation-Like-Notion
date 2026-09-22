import { readFile } from "node:fs/promises"
import yaml from "js-yaml"

const workflowPath = ".github/workflows/pages.yml"
const workflow = yaml.load(await readFile(workflowPath, "utf8"))

function requireValue(condition, message) {
  if (!condition) throw new Error(message)
}

requireValue(workflow && typeof workflow === "object", "Pages workflow must be a YAML object")
const triggers = workflow.on
requireValue(triggers && typeof triggers === "object", "Pages workflow must define triggers")
requireValue(
  Object.keys(triggers).length === 1 && "push" in triggers,
  "Pages deploy must trigger only on push",
)
requireValue(
  Array.isArray(triggers.push?.branches) &&
    triggers.push.branches.length === 1 &&
    triggers.push.branches[0] === "release",
  "Pages deploy must trigger only from the release branch",
)
requireValue(
  workflow.permissions?.contents === "read",
  "Top-level repository contents permission must be read-only",
)
requireValue(workflow.concurrency?.group === "pages", "Pages concurrency group must be pages")

const buildSteps = workflow.jobs?.build?.steps
requireValue(Array.isArray(buildSteps), "Pages workflow must define build steps")
const runCommands = buildSteps.flatMap((step) => (typeof step.run === "string" ? [step.run] : []))
for (const command of [
  "npm ci",
  "npm run pages:verify",
  "npm run demo:build",
  "npm run demo:verify",
]) {
  requireValue(runCommands.includes(command), `Pages workflow is missing ${command}`)
}
const uploadStep = buildSteps.find((step) => step.uses === "actions/upload-pages-artifact@v3")
requireValue(
  uploadStep?.with?.path === "apps/web/dist-demo",
  "Pages workflow must upload only apps/web/dist-demo",
)
requireValue(workflow.jobs?.deploy?.permissions?.pages === "write", "Deploy job needs pages: write")
requireValue(
  workflow.jobs?.deploy?.permissions?.["id-token"] === "write",
  "Deploy job needs id-token: write",
)
requireValue(
  workflow.jobs?.deploy?.needs === "build",
  "Deploy job must require the verified build job",
)

process.stdout.write("Pages workflow verification passed.\n")
