import { expect, test } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.goto("")
  await page.locator(".demo-entry button").click()
  await expect(page.locator(".library-card").first()).toBeVisible()
})

test("starts, reads, switches available headers, searches, records recent, and exits", async ({
  page,
}) => {
  await page.locator(".library-card").first().click()
  const firstArticle = page.locator(".article-list a").first()
  await expect(firstArticle).toBeVisible()
  const title = (await firstArticle.locator("strong").innerText()).trim()
  await firstArticle.click()

  await expect(page.locator(".article-page")).toBeVisible()
  const template = page.locator(".article-toolbar select")
  const options = await template
    .locator("option")
    .evaluateAll((elements) => elements.map((element) => (element as HTMLOptionElement).value))
  for (const [value, testId] of [
    ["simple", "simple-header"],
    ["compact-emblem", "compact-emblem-header"],
    ["cactus-study", "cactus-study-header"],
  ] as const) {
    if (!options.includes(value)) continue
    await template.selectOption(value)
    await expect(page.getByTestId(testId)).toBeVisible()
  }
  const activeHeader = page.locator("[data-testid$='-header']").first()
  await expect(activeHeader).toBeVisible()
  expect(
    await activeHeader.evaluate(
      (element) => element.getBoundingClientRect().right <= window.innerWidth,
    ),
  ).toBe(true)

  await page.locator('nav a[href="#/search"]').click()
  await page.locator('input[type="search"]').fill(title.slice(0, 24))
  await page.locator(".search-form button").click()
  await expect(page.locator(".article-list a").first()).toBeVisible()

  await page.locator("a.brand").click()
  await expect(page.locator(".page-home section .article-list a").first()).toBeVisible()

  await page.locator(".topbar button").click()
  await expect(page.locator(".demo-entry")).toBeVisible()
})

test("keeps the selected public article available offline", async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desktop", "One browser proves offline precache")
  await page.locator(".library-card").first().click()
  await page.locator(".article-list a").first().click()
  await expect(page.locator(".article-page")).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator(".article-page")).toBeVisible()
  await expect(page.locator("[data-testid$='-header']").first()).toBeVisible()
  await context.setOffline(false)
})
