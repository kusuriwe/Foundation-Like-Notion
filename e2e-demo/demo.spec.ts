import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("")
  await page.locator(".demo-entry button").click()
  await expect(page.getByRole("link", { name: /Demo Science Notes/ })).toBeVisible()
})

test("starts, reads, switches header, searches, records recent, and exits", async ({ page }) => {
  await page.getByRole("link", { name: /Demo Science Notes/ }).click()
  await page.locator(".article-list a").first().click()

  await expect(page.getByTestId("simple-header")).toBeVisible()
  await expect(page.locator(".katex").first()).toBeVisible()
  await expect(page.locator('img[src*="/Foundation-Like-Notion/demo/"]')).toBeVisible()
  await expect(page.locator(".callout-blue_background")).toBeVisible()
  await expect(
    page.getByText("Nested callout content is rendered with the safe block renderer."),
  ).toBeVisible()
  await expect(page.getByRole("heading", { name: "Demo observations" })).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Demo observations" })).toBeVisible()
  await expect(page.getByRole("cell", { name: "Yellow emission" })).toBeVisible()
  expect(
    await page
      .locator(".embedded-table .table-scroll")
      .evaluate((element) => element.scrollWidth >= element.clientWidth),
  ).toBe(true)

  await page.getByLabel("Template").selectOption("compact-emblem")
  await expect(page.getByTestId("compact-emblem-header")).toBeVisible()
  await page.getByLabel("Template").selectOption("cactus-study")
  const cactus = page.getByTestId("cactus-study-header")
  await expect(cactus).toBeVisible()
  await expect(cactus).toContainText("Classification record")
  await expect(cactus).toContainText("Main-class")
  expect(
    await cactus.evaluate((element) => element.getBoundingClientRect().right <= window.innerWidth),
  ).toBe(true)
  await page.getByRole("button", { name: "chemistry", exact: true }).click()
  await expect(page.getByText("Tag:")).toBeVisible()
  await expect(page.locator(".article-list a")).not.toHaveCount(0)

  await page.locator("a.brand").click()
  await expect(page.getByRole("heading", { name: "Recently read" })).toBeVisible()
  await expect(page.locator(".article-list a")).not.toHaveCount(0)

  await page.getByRole("button", { name: "Exit demo" }).click()
  await expect(page.locator(".demo-entry")).toBeVisible()
})

test("keeps bundled public articles available offline", async ({ context, page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "One browser proves the offline bundle path",
  )
  await page.getByRole("link", { name: /Demo Science Notes/ }).click()
  await page.locator(".article-list a").first().click()
  await expect(page.locator(".article-page")).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator(".article-page")).toBeVisible()
  await expect(page.locator(".katex").first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Demo observations" })).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Demo observations" })).toBeVisible()
  await context.setOffline(false)
})
