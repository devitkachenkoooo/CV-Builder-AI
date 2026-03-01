# CV Beautify

> **🔗 Live demo:** [https://cv-builder-ai--devitkachenko.replit.app/](https://cv-builder-ai--devitkachenko.replit.app/)

An AI-powered web app that generates polished, professional resumes from any uploaded document in seconds. Simply upload your existing CV (PDF, DOCX, or plain text), pick a template — and the AI rewrites, structures, and formats your content into a pixel-perfect resume, ready to download as a PDF.

---

## ✨ Features

- **AI Content Extraction** — Upload a PDF, DOCX, or TXT file. The AI (powered by OpenAI GPT-4o) reads your raw content, understands it as a resume, and adapts it to the selected template.
- **10 Professional Templates** — Carefully crafted HTML/CSS templates ranging from minimalist to two-column designs, with full color backgrounds.
- **Smart PDF Generation** — Custom PDF engine that handles multi-page layouts, consistent margins, background fills, and never splits a content block mid-element.
- **Multi-language UI** — Interface available in English and Ukrainian (i18n via i18next).
- **Resume Management** — Save, view, and re-download all previously generated resumes from your dashboard.
- **Responsive Design** — Works on desktop and mobile, including collapsible navigation for smaller screens.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| **Backend** | Node.js, Express 5, TypeScript (tsx) |
| **Database** | PostgreSQL + Drizzle ORM |
| **AI** | OpenAI API (GPT-4o) |
| **PDF** | html2pdf.js + custom pagination engine |
| **Auth** | Passport.js (local strategy) + express-session |
| **File Parsing** | mammoth (DOCX), native PDF text extraction |
| **Routing** | wouter (client), Express (server) |
| **State** | TanStack React Query |

---

## 🚀 Deployment

This project is hosted and deployed on **[Replit](https://replit.com)**.
All infrastructure, secrets, and environment configuration are managed there.

To run your own instance, fork the project on Replit and set the following secrets in the Replit Secrets panel:

| Secret | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key (`sk-...`) |
| `SESSION_SECRET` | Random string for session signing |

Replit handles the rest automatically on every run.

---

## 📁 Project Structure

```
├── client/                   # React frontend (Vite)
│   ├── public/
│   │   └── templates/        # 10 HTML resume templates (template-1.html … template-10.html)
│   └── src/
│       ├── components/       # Reusable UI components
│       ├── hooks/            # Custom React hooks (use-generate, use-resumes, …)
│       ├── lib/
│       │   ├── pdf-generator.ts   # Custom PDF pagination engine ← see docs/PDF_GENERATOR.md
│       │   └── i18n.ts            # Internationalization setup
│       └── pages/            # Route-level page components
├── server/
│   ├── routes.ts             # All API routes (resumes, generate, auth, templates)
│   ├── lib/
│   │   └── cv-validator.ts   # AI-based CV content validation
│   └── storage.ts            # Database access layer
├── shared/
│   └── schema.ts             # Drizzle schema + Zod validation types
└── docs/
    └── PDF_GENERATOR.md      # PDF engine deep-dive & customisation guide
```

---

## 🔄 How It Works

```
User uploads CV file
        ↓
Server extracts text (DOCX → mammoth, PDF → text extraction)
        ↓
AI validates it's actually a CV (cv-validator.ts)
        ↓
User picks a template in the modal
        ↓
Server calls OpenAI GPT-4o to rewrite & inject content into the HTML template
        ↓
Generated HTML is saved to the database (resumes table)
        ↓
CvViewPage fetches the HTML and renders it in an iframe
        ↓
User clicks "Download PDF" → pdf-generator.ts runs the custom pagination logic
        ↓
html2pdf.js renders the final PDF with correct page breaks and backgrounds
```

---

## 📄 PDF Generation

See **[docs/PDF_GENERATOR.md](docs/PDF_GENERATOR.md)** for a detailed explanation of how the PDF pagination engine works and how to customise it.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a Pull Request

---

## 📝 License

MIT
