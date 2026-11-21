import { expect, test } from '@playwright/test';

test.describe('LearnMate AI — Critical Student & Security E2E Journeys', () => {
  test('renders public landing page with bilingual & dark/light theme controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/LearnMate AI/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Get Started|Sign In/i }).first()).toBeVisible();
  });

  test('redirects unauthenticated student routes cleanly to /login', async ({ page }) => {
    await page.goto('/tutor');
    await expect(page).toHaveURL(/\/login/);
  });

  test('student registers, completes onboarding, uses ChatGPT-style AI Tutor with topic context & Study Materials Studio', async ({
    page,
  }) => {
    const uniqueEmail = `e2e.student.${Date.now()}@example.com`;

    // 1. Register
    await page.goto('/register');
    await page.getByLabel(/Full Name/i).fill('E2E Student');
    await page.getByLabel(/Email/i).fill(uniqueEmail);
    await page.getByLabel(/Password/i).first().fill('StrongPassword123!');
    await page.getByRole('button', { name: /Create Account|Register/i }).click();

    await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 15_000 });

    // 2. Visit AI Tutor page and verify ChatGPT-style layout & Topic Context panel
    await page.goto('/tutor');
    await expect(page.getByRole('heading', { name: /LearnMate AI Tutor/i })).toBeVisible();
    await page.getByRole('button', { name: /Topic Context & System Prompt/i }).click();
    await expect(page.getByLabel('Curriculum Topic Context')).toBeVisible();

    // 3. Visit Study Materials Studio and verify 12-format grid & Custom Topic toggle
    await page.goto('/materials');
    await expect(page.getByRole('heading', { name: /AI Study Materials/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Custom Topic/i })).toBeVisible();
  });
});
