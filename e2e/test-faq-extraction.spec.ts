import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PDF_PATH = path.resolve(__dirname, '../../UNO Bank F&Q.pdf');
const TXT_PATH = path.resolve(__dirname, '../public/test-docs/UNO_Bank_Additional_Policy.txt');
const SCREENSHOT_DIR = path.resolve(__dirname, '../test-screenshots');

test.describe('FAQ Extraction & Cross-Document Conflicts', () => {
  test('FAQ extraction quality and cross-document conflicts', async ({ page }) => {
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

    // --- PART 1: Single PDF, check FAQs ---
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Upload PDF
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(PDF_PATH);
    await page.waitForTimeout(2000);

    // Ingest
    await page.getByRole('button', { name: /Ingest Documents/i }).click();
    await page.waitForTimeout(1500);

    // Navigate to FAQs - use sidebar or Next buttons
    await page.getByRole('button', { name: /FAQs/i }).first().click();
    await page.waitForTimeout(500);

    // Ensure we're on FAQs step (step 4)
    const faqsHeading = page.getByRole('heading', { name: /FAQs/i });
    await expect(faqsHeading).toBeVisible();
    await page.waitForTimeout(300);

    // Take screenshot of FAQs page
    await takeScreenshot('faq-extraction-faqs-page');
    console.log('Screenshot: faq-extraction-faqs-page.png');

    // Count FAQs and verify Q&A separation
    const qaCards = page.locator('.qa-card');
    const faqCount = await qaCards.count();
    console.log(`FAQs generated: ${faqCount}`);

    let allProperlySeparated = true;
    const faqDetails: { q: string; a: string }[] = [];
    for (let i = 0; i < Math.min(faqCount, 5); i++) {
      const card = qaCards.nth(i);
      const questionEl = card.locator('.qa-q');
      const answerEl = card.locator('.qa-a');
      const q = await questionEl.textContent().catch(() => '');
      const a = await answerEl.textContent().catch(() => '');
      faqDetails.push({ q: q || '', a: a || '' });
      const qLen = (q || '').trim().length;
      const aLen = (a || '').trim().length;
      if (qLen < 5 || aLen < 5) {
        allProperlySeparated = false;
      }
    }
    console.log('Sample FAQs:', JSON.stringify(faqDetails, null, 2));
    console.log(`Q&A separation looks correct: ${allProperlySeparated}`);

    // --- PART 2: Add second doc, re-ingest, check conflicts ---
    // Go back to Upload via sidebar
    await page.getByRole('button', { name: /Upload/i }).first().click();
    await page.waitForTimeout(500);

    // We should see the upload area - add second file (multiple mode adds)
    const fileInput2 = page.locator('input[type="file"]');
    await fileInput2.setInputFiles(TXT_PATH);
    await page.waitForTimeout(1500);

    // Verify both docs in list
    await expect(page.getByText(/UNO Bank F&Q\.pdf|UNO Bank/)).toBeVisible();
    await expect(page.getByText(/UNO_Bank_Additional_Policy\.txt|Additional_Policy/)).toBeVisible();

    // Ingest again with both files
    await page.getByRole('button', { name: /Ingest Documents/i }).click();
    await page.waitForTimeout(1500);

    // Navigate to Conflicts via sidebar
    await page.getByRole('button', { name: /Conflicts/i }).first().click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: /Conflict Detection/i })).toBeVisible();
    await takeScreenshot('faq-extraction-conflicts-cross-doc');
    console.log('Screenshot: faq-extraction-conflicts-cross-doc.png');

    // Check for cross-document conflicts
    const crossDocSection = page.getByText(/Cross-Document Conflicts/i);
    const noConflicts = page.getByText(/No Conflicts Found/i);
    const hasCrossDoc = await crossDocSection.isVisible().catch(() => false);
    const hasNoConflicts = await noConflicts.isVisible().catch(() => false);
    console.log(`Cross-document conflicts detected: ${hasCrossDoc}`);
    console.log(`No conflicts: ${hasNoConflicts}`);

    // Write report to file for easy retrieval
    const report = {
      faqCount,
      qaSeparationCorrect: allProperlySeparated,
      sampleFaqs: faqDetails,
      crossDocumentConflictsFound: hasCrossDoc,
      noConflictsFound: hasNoConflicts,
    };
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'faq-extraction-report.json'),
      JSON.stringify(report, null, 2)
    );
  });
});
