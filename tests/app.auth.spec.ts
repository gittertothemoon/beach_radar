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

  test("register prioritizes password mismatch over weak-password error", async ({ page }) => {
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));

    await page.getByPlaceholder(/^Nome$/).fill("Mario");
    await page.getByPlaceholder(/^Cognome$/).fill("Rossi");
    await page.getByPlaceholder("es. onda_93").fill("mario.rossi");
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Ab1!");
    await page.getByPlaceholder("Ripeti la password").fill("Ab1!diversa");
    await page.getByRole("checkbox", { name: /accetto termini, privacy/i }).check();
    await page.getByTestId("auth-submit").click();

    await expect(page.getByText("Le password non coincidono.")).toBeVisible();
    await expect(page.getByText("Password troppo debole. Segui i requisiti indicati sotto il campo.")).not.toBeVisible();
  });

  test("reset mode prioritizes password mismatch over weak-password error", async ({ page }) => {
    await page.goto(withQuery("/app/register", { mode: "reset", returnTo: "/app/" }));

    await page.getByTestId("auth-password-input").fill("Ab1!");
    await page.getByPlaceholder("Ripeti la password").fill("Ab1!diversa");
    await page.getByTestId("auth-submit").click();

    await expect(page.getByText("Le password non coincidono.")).toBeVisible();
    await expect(page.getByText("Password troppo debole. Segui i requisiti indicati sotto il campo.")).not.toBeVisible();
  });
});
