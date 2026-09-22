import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import yaml from "js-yaml"

const outputDirectory = path.resolve("apps/web/dist-demo")
const requiredFiles = ["index.html", "manifest.webmanifest", "sw.js"]
const forbidden = [
  "/api/",
  "api.notion.com",
  "@notionhq/client",
  "NOTION_TOKEN",
  "READER_PASSWORD_HASH",
  "READER_CONFIG_PATH",
  ".env/",
  "sourceDataSourceId",
  "titlePropertyId",
  "propertyId",
]

async function optionalText(file) {
  try {
    return await readFile(file, "utf8")
  } catch (error) {
    if (error?.code === "ENOENT") return undefined
    throw error
  }
}

function configuredIdentifiers(value, key = "") {
  if (Array.isArray(value)) return value.flatMap((entry) => configuredIdentifiers(entry, key))
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([childKey, child]) =>
      configuredIdentifiers(child, childKey),
    )
  }
  return /(?:property|source).*id|relationSources/i.test(key) &&
    typeof value === "string" &&
    value.length >= 8
    ? [value]
    : []
}

const localForbiddenValues = []
const localEnvironment = await optionalText(".env/reader.env")
if (localEnvironment) {
  for (const line of localEnvironment.split(/\r?\n/)) {
    const match = line.match(/^[A-Z][A-Z0-9_]*=(.*)$/)
    const value = match?.[1]?.trim().replace(/^['"]|['"]$/g, "")
    if (value && value.length >= 8) localForbiddenValues.push(value)
  }
}
const localReaderYaml = await optionalText(".env/reader.yaml")
if (localReaderYaml) {
  localForbiddenValues.push(...configuredIdentifiers(yaml.load(localReaderYaml)))
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const absolute = path.join(directory, entry.name)
      return entry.isDirectory() ? files(absolute) : [absolute]
    }),
  )
  return nested.flat()
}

for (const file of requiredFiles) {
  await readFile(path.join(outputDirectory, file))
}

const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".webmanifest"])
for (const file of await files(outputDirectory)) {
  if (!textExtensions.has(path.extname(file))) continue
  const content = await readFile(file, "utf8")
  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(
        `Demo output contains forbidden marker ${marker} in ${path.relative(outputDirectory, file)}`,
      )
    }
  }
  for (const value of localForbiddenValues) {
    if (content.includes(value)) {
      throw new Error(
        `Demo output contains a value from ignored local configuration in ${path.relative(outputDirectory, file)}`,
      )
    }
  }
}

const index = await readFile(path.join(outputDirectory, "index.html"), "utf8")
if (!index.includes("/Foundation-Like-Notion/")) {
  throw new Error("Demo index is not configured for the GitHub Pages project path")
}

const manifest = JSON.parse(
  await readFile(path.join(outputDirectory, "manifest.webmanifest"), "utf8"),
)
if (manifest.start_url !== "/Foundation-Like-Notion/") {
  throw new Error("Demo manifest start_url is invalid")
}

process.stdout.write("Demo artifact verification passed.\n")
