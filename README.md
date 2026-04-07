# RAG Knowledge Content Creation UI

Enterprise knowledge base content creation tool for Exotel's RAG (Retrieval Augmented Generation) system. Upload documents, detect issues, resolve conflicts, generate FAQs, and export a clean knowledge base.

## Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- A modern browser (Chrome recommended)

## Quick Start

```bash
# 1. Navigate into the project folder
cd rag-ui

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

Open **http://localhost:5173** in your browser. That's it.

## What This Does

A step-by-step workflow to create high-quality knowledge documents for RAG:

1. **Upload** — Drag & drop or select PDF, DOCX, or TXT files. Supports single or multiple documents.
2. **Unreadable Content** — Auto-detects garbled text, OCR errors, and missing image content.
3. **Terminology** — Auto-detects non-English / undefined terms (acronyms, brand names, jargon) for user definition. Includes find-and-replace style search across all documents.
4. **Conflicts** — Detects contradictions within a document and across multiple documents, with page numbers.
5. **FAQs** — Extracts or generates Q&A pairs. Accept, edit, add, or delete. Download as DOCX. Validates against Content Writing Guidelines (14 rules checked automatically).
6. **Final Review** — Approve all FAQs, resolve skipped steps, and train the RAG system.

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm test` | Run unit + integration + flow tests (Vitest) |
| `npm run test:e2e` | Run browser E2E tests (Playwright — requires `npx playwright install` first) |

## Project Structure

```
rag-ui/
├── public/
│   ├── exotel-logo.png          # Exotel branding
│   └── test-docs/               # Sample test documents
├── src/
│   ├── components/              # React UI components
│   │   ├── Layout.tsx           # Sidebar + navigation
│   │   ├── Upload.tsx           # Document upload page
│   │   ├── UnreadableContentStep.tsx
│   │   ├── TerminologyStep.tsx
│   │   ├── ConflictStep.tsx
│   │   ├── FAQStep.tsx
│   │   └── FinalReviewStep.tsx
│   ├── services/
│   │   ├── documentParser.ts    # PDF/DOCX/TXT parsing
│   │   └── textAnalyzer.ts      # All analysis logic
│   ├── store/
│   │   └── useStore.ts          # Zustand state management
│   ├── styles/                  # Vanilla CSS
│   ├── tests/                   # Unit, integration, flow tests
│   ├── App.tsx
│   └── main.tsx
├── e2e/                         # Playwright browser tests
├── package.json
└── vite.config.ts
```

## Tech Stack

- **React 19** + TypeScript
- **Vite** (build tool)
- **Zustand** (state management)
- **Framer Motion** (animations)
- **Lucide React** (icons)
- **pdfjs-dist** (PDF parsing)
- **mammoth** (DOCX parsing)
- **docx** + **file-saver** (DOCX export)
- **Vitest** + **React Testing Library** (tests)
- **Playwright** (E2E browser tests)

## Troubleshooting

- **Port 5173 already in use?** — Kill the existing process: `lsof -ti:5173 | xargs kill -9`, then re-run `npm run dev`.
- **Blank screen?** — Open browser devtools (F12) and check Console for errors. Run `npm run build` to verify the build is clean.
- **PDF parsing issues?** — The pdf.js worker loads from `node_modules`. Ensure `npm install` completed without errors.
