import { expect, test } from "@playwright/test"

test("login, read, switch template, search, recent, and logout", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Password").fill("reader-test")
  await page.getByRole("button", { name: "Login" }).click()

  await expect(
    page.getByRole("heading", { name: "Your Notion, shaped for reading." }),
  ).toBeVisible()
  await page.getByRole("link", { name: /Chemistry Notes/ }).click()
  await page.getByRole("link", { name: /炎色反応/ }).click()

  await expect(page.getByRole("heading", { name: "炎色反応" })).toBeVisible()
  await page.getByLabel("Template").selectOption("compact-emblem")
  await expect(page.getByTestId("compact-emblem-header")).toContainText("FLAME TEST")

  await page.getByRole("button", { name: "chemistry", exact: true }).click()
  await expect(page.getByText("Tag:")).toBeVisible()
  await expect(page.getByRole("link", { name: /炎色反応/ })).toBeVisible()

  await page.getByRole("link", { name: "NOTION READER" }).click()
  await expect(page.getByRole("heading", { name: "Recently read" })).toBeVisible()
  await expect(page.getByRole("link", { name: /炎色反応/ })).toBeVisible()

  await page.getByRole("button", { name: "Logout" }).click()
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible()
})
