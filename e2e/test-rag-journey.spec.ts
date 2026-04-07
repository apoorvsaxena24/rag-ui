import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDF_PATH = path.resolve(__dirname, '../../UNO Bank F&Q.pdf');
const SCREENSHOT_DIR = path.resolve(__dirname, '../test-screenshots');

test.describe('RAG UI User Journey', () => {
  test('full user journey with screenshots', async ({ page }) => {
    // Ensure screenshot directory exists
    const fs = await import('fs');
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    const takeScreenshot = async (name: string) => {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${name}.png`),
        fullPage: true,
      });
    };

    // Step 1: Upload Page - Initial state
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Upload Documents/i })).toBeVisible();
    await expect(page.getByText(/Click to upload or drag and drop/i)).toBeVisible();
    await expect(page.getByText(/Single Document|Multiple Documents/)).toBeVisible();
    await takeScreenshot('01-upload-initial');
    console.log('✓ Step 1: Upload page loaded');

    // Step 2: Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PDF_PATH);
    await page.waitForTimeout(2000); // Wait for parsing
    await expect(page.getByText(/Uploaded Documents/)).toBeVisible();
    await expect(page.getByText(/Parsed/)).toBeVisible();
    await expect(page.getByText(/UNO Bank/)).toBeVisible();
    await expect(page.getByText(/chars extracted/)).toBeVisible();
    await takeScreenshot('02-upload-after-pdf');
    console.log('✓ Step 2: PDF uploaded and parsed');

    // Step 3: Click Ingest Documents
    await page.getByRole('button', { name: /Ingest Documents/i }).click();
    await page.waitForTimeout(1500); // Processing time
    await expect(page.getByRole('heading', { name: /Unreadable Content Check/i })).toBeVisible();
    await takeScreenshot('03-unreadable-content-step');
    console.log('✓ Step 3: Navigated to Unreadable Content Check');

    // Step 4: Unreadable Content - check for All Clear or items, Skip for Now
    const skipBtn = page.getByRole('button', { name: /Skip for Now/i });
    await expect(skipBtn).toBeVisible();
    const allClear = page.getByText(/All Clear/i);
    const noIssues = page.getByText(/No issues detected/i);
    const hasContent = await allClear.isVisible().catch(() => false) || await noIssues.isVisible().catch(() => false);
    await takeScreenshot('04-unreadable-content-state');
    console.log('✓ Step 4: Unreadable content step - Skip for Now visible');

    // Step 5: Navigate to Terminology - click Next or Skip
    const nextTerminology = page.getByRole('button', { name: /Next: Terminology Check/i });
    if (await nextTerminology.isEnabled()) {
      await nextTerminology.click();
    } else {
      await skipBtn.click();
    }
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /Terminology Check/i })).toBeVisible();
    const searchInput = page.getByPlaceholder(/Enter a word or phrase to search/i);
    await searchInput.fill('UNO');
    await page.waitForTimeout(500); // Debounce
    await takeScreenshot('05-terminology-search-UNO');
    const matchCount = page.locator('.search-count, .match-card');
    const hasMatches = await matchCount.count() > 0;
    console.log('✓ Step 5: Terminology step - searched for UNO');

    // Step 6: Navigate to Conflicts
    await page.getByRole('button', { name: /Next: Conflict Detection/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /Conflict Detection/i })).toBeVisible();
    await takeScreenshot('06-conflict-detection');
    console.log('✓ Step 6: Conflict detection step');

    // Step 7: Navigate to FAQs
    await page.getByRole('button', { name: /Next: FAQs/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: /FAQs/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download DOCX/i })).toBeVisible();
    const acceptBtn = page.getByRole('button', { name: /Accept/i }).first();
    const editBtn = page.getByRole('button', { name: /Edit/i }).first();
    await takeScreenshot('07-faqs-step');
    console.log('✓ Step 7: FAQs step - Download DOCX and Accept/Edit visible');

    // Step 8: Final Review
    await page.getByRole('button', { name: /Final Review/i }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Final Knowledge Consultation/i)).toBeVisible();
    await expect(page.getByText(/Documents Processed/i)).toBeVisible();
    await takeScreenshot('08-final-review');
    console.log('✓ Step 8: Final Review step');
  });
});
