import { expect, test } from "@playwright/test";
import { withQuery } from "./helpers/app";

test.describe("auth form", () => {
  test("login submits with Enter key", async ({ page }) => {
    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));

    await page.getByTestId("auth-email-input").fill("email-non-valida");
    await page.getByTestId("auth-password-input").fill("Password123!");
    await page.getByTestId("auth-password-input").press("Enter");

    await expect(page.getByText("Inserisci un'email valida.")).toBeVisible();
  });

  test("forgot password submits with Enter key", async ({ page }) => {
    await page.goto(withQuery("/app/register", { mode: "forgot", returnTo: "/app/" }));

    await page.getByTestId("auth-email-input").press("Enter");

    await expect(page.getByText("Compila tutti i campi obbligatori.")).toBeVisible();
  });
});
