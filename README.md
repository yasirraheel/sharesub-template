# Sharesub Offline Website Template

This repository is a cleaned, reusable static template based on the supplied Sharesub page captures. It contains the website pages and the local CSS, JavaScript, image, SVG, font, favicon, and blog assets needed to preview the captured experience without loading remote page resources.

## What is included

### Main website pages

| Route | Page |
| --- | --- |
| `/en/` | Homepage |
| `/en/subscriptions` | Subscription catalogue |
| `/en/subscriptions/house/` | House category listing |
| `/en/brand/amazon/` | Amazon product detail |
| `/en/register` | Registration page |
| `/en/userlogin` | Login page |

### CMS and blog pages

| Route | Page |
| --- | --- |
| `/cms/en/` | Blog homepage |
| `/cms/en/duolingo-family-plan-cost-current-discounts-on-duolingo-super-max/` | Duolingo article |
| `/cms/en/team/` | About Us / team |
| `/cms/en/legal/` | Legal information |
| `/cms/en/legal/tos/` | Terms of Use |
| `/cms/en/buyer-protection-program/` | Buyer Protection Program |

The homepage Buyer Protection Program card links to the local Buyer Protection page. Site logos, captured internal navigation, and the local footer links use these routes instead of the original live-site paths.

## Run locally

Requirements:

- Node.js 18 or newer
- No npm dependency installation is required

From this folder, run:

```powershell
npm run dev
```

Then open:

```text
http://127.0.0.1:4174/
```

You can also use:

```powershell
npm start
```

The included server supports directory routes such as `/en/`, `/cms/en/team/`, and `/cms/en/buyer-protection-program/`, and also keeps the `.html` route aliases available.

## Why a local server is recommended

The pages use root-relative paths such as `/css/app.css`, `/js/app.js`, and `/cms/...`. Browsers opened with `file://` do not consistently resolve these routes or execute local modules and navigation in the same way as a website. The included server provides the correct local origin while keeping every captured resource on the local machine.

## Project structure

```text
Sharesub/
├── en/                         Main English website pages
├── cms/en/                     Blog, legal, team, and protection pages
├── css/                        Local stylesheets
├── js/                         Local runtime and offline guard
├── img/                        Dashboard and feature images
├── images/                     Captured image assets
├── fonts/                      Local font files
├── cms/wp-content/             Local CMS styles, scripts, and uploads
├── favicon.ico                 Site favicon
├── site.webmanifest            Web app manifest
├── index.html                  Root redirect/entry page
├── package.json                Zero-dependency local server commands
└── scripts/serve.mjs           Static development server
```

## Offline and external-link behavior

Page resources are local: CSS, JavaScript, fonts, images, SVGs, and captured HTML do not need the internet to render. The local offline guard prevents accidental third-party fetches and external navigation during offline use.

The source footer links are preserved rather than deleted. Some destinations—such as Privacy Policy, Contact us, Recruiting, Business Services, and DMCA—were not included as usable local captures, so their original external URLs remain in the markup. Those destinations require internet access; they are intentionally not represented by invented placeholder pages.

## Reusing this template

1. Copy the `Sharesub` folder into a project.
2. Keep the same root-relative folder structure, or update the paths in the HTML files if the template is mounted below a subdirectory.
3. Replace page content and images while keeping the shared `css`, `js`, `fonts`, and `cms/wp-content` assets.
4. Use the local server during development and deploy the folder to any static hosting service when ready.

## Important notes

- This is a frontend-only static capture. Forms and account actions are visual UI only and do not connect to a real Sharesub account.
- Dynamic catalogue prices, authentication, payments, analytics, chat, consent services, and third-party tracking are not implemented.
- The captured brand content and assets remain subject to their original owner’s terms. Use this repository for authorized design, testing, and template work.

## Verification checklist

The clean export was checked for:

- HTTP 200 responses for the homepage, subscription pages, login/register pages, legal pages, team page, and Buyer Protection page.
- Local homepage navigation to the Buyer Protection Program page.
- Local logo navigation back to the homepage.
- Local captured Terms of Use, Legal Information, and About Us routes.
- No remote `src` or `poster` resource dependencies in the Buyer Protection page.
- No removal of footer links by the cleanup workflow.
