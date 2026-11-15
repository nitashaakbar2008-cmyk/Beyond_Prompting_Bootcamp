# Lumière Books

A premium online bookstore (demo) with a customer storefront, a Mini CRM dashboard for the merchant, and Lumi, a live AI reading assistant. The books, customers, orders and reviews are fictional demonstration data. No real payments are taken.

## Screenshots
These were taken from this exact project running on a computer, without changing its code.

### Homepage
The welcome screen with the illustrated assistant whose eyes follow your cursor, the search bar and the main navigation.

![Homepage](screenshots/01-homepage.png)

### About and book categories
The About section and the ten book categories, each with a description, a book count and an Explore Category button.

![About and book categories](screenshots/02-categories.png)

### Featured books
Book cards with cover, author, price (PKR), rating, stock, wishlist heart and Add to Cart.

![Featured books](screenshots/03-featured-books.png)

### Reader reviews
Review cards. "Sample" labels mark fictional demo reviews; "Verified Customer" appears only when a review matches an order.

![Reader reviews](screenshots/04-reader-reviews.png)

### Catalogue, search and filters
All 100 books with category, price, rating and in-stock filters, and sorting.

![Catalogue, search and filters](screenshots/05-catalogue-and-filters.png)

### Product details
A single book with its description, specifications, quantity selector, reviews and related books.

![Product details](screenshots/06-product-details.png)

### Lumi, the AI reading companion
The floating gold book button opens the chat window. It answers once you add an API key (see "AI assistant setup"); without a key it says it is not connected yet.

![Lumi, the AI reading companion](screenshots/07-ai-assistant-chat.png)

### Shopping cart
Quantity controls, stock limits, delivery charge and total.

![Shopping cart](screenshots/08-shopping-cart.png)

### Checkout (demonstration)
Cash on Delivery only. No card or banking details are collected.

![Checkout (demonstration)](screenshots/09-checkout.png)

### Order confirmation
Shows the order ID, items, total and the "Pending" status.

![Order confirmation](screenshots/10-order-confirmation.png)

### Merchant CRM: dashboard
Totals, charts, recent orders and the low-stock watchlist, all calculated from stored data.

![Merchant CRM: dashboard](screenshots/11-crm-dashboard.png)

### CRM: Orders and Delivery
Search, filter and sort orders; open one to update its status or add internal notes. The row "Demo Reader" is an order placed while taking these screenshots; rows marked "demo" are built-in fictional samples.

![CRM: Orders and Delivery](screenshots/12-crm-orders.png)

### CRM: Product inventory
Add, edit or delete books; price, stock and availability changes appear on the storefront.

![CRM: Product inventory](screenshots/13-crm-product-inventory.png)

### CRM: Customer directory
Customers (matched by email), order counts and total spending.

![CRM: Customer directory](screenshots/14-crm-customers.png)

### CRM: Support inquiries
Complaints, suggestions and questions sent from the Contact page, with status and internal notes.

![CRM: Support inquiries](screenshots/15-crm-support-inquiries.png)

### CRM: Customer reviews
Hide or publish reviews; shows whether each review is verified against an order.

![CRM: Customer reviews](screenshots/16-crm-reviews.png)

### CRM: Reports and analytics
Revenue, average order value, best sellers and customer sign-ups.

![CRM: Reports and analytics](screenshots/17-crm-reports.png)

### Mobile: homepage
The same website on a phone-sized screen.

![Mobile: homepage](screenshots/18-mobile-homepage.png)

### Mobile: AI assistant
The chat window fits a phone screen.

![Mobile: AI assistant](screenshots/19-mobile-ai-assistant.png)

## What is in this project
| Folder / file | What it is |
|---|---|
| `index.html` | The page that loads the whole website |
| `src/` | The storefront and CRM code: `styles/main.css` (design), `data/catalogue.js` (the 100 books), `storefront/` (pages, cart, checkout, reviews, wishlist, assistant eyes), `admin/` (the CRM), `services/`, `utils/`, `main.js` |
| `assistant/` | The chat window design and behaviour for Lumi |
| `server.mjs` | The small server that runs the website and the AI chat connection |
| `ai-backend/`, `context/` | Secure AI chat code, the catalogue file and store policies Lumi uses |
| `data-api/`, `data-adapter/`, `database/` | Optional Supabase database add-on (not used by the website yet) |
| `scripts/`, `api/chat.js`, `render.yaml` | Helper scripts and optional hosting files |
| `package.json`, `.env.example`, `.gitignore` | Project settings and a template for your secret keys |

## Technologies
HTML, CSS, JavaScript (no frameworks), Node.js (a tiny server with no extra packages), browser LocalStorage for saving data, and an AI service for Lumi (Anthropic API). There are **no npm dependencies**, so nothing needs installing besides Node.js.

## Open it in Visual Studio Code
1. Unzip the download.
2. Open Visual Studio Code, choose **File → Open Folder…** and pick the unzipped `lumiere-books-source` folder.
3. Open the built-in terminal with **Terminal → New Terminal**.

## Install what is needed
Install **Node.js 18 or newer** from nodejs.org (the LTS button), then check it in the terminal with `node --version`. There is no `npm install` step.

## AI assistant setup (optional)
The website works without this. Only Lumi's replies need a key.
1. Create an API key in the Anthropic Console (usage is billed by Anthropic).
2. Copy the file `.env.example` and name the copy `.env`.
3. Open `.env`, and replace `paste-your-anthropic-api-key-here` with your key. Never share or upload this file (it is already ignored by git).

## Run the website
In the terminal type:
```bash
npm start
```
Then open:
- Storefront: http://localhost:5173/
- CRM dashboard: http://localhost:5173/admin (click "Enter Merchant Dashboard"; there is no password)

Stop the server with Ctrl+C. To use another port: `PORT=3000 npm start` (Mac/Linux) or `$env:PORT=3000; npm start` (Windows PowerShell).

## Good to know
- Everything you do (cart, orders, inquiries, product edits) is saved in your own browser only, not in a shared database. Clearing browser data resets it.
- The CRM entry button is a demo gate, not real security.
- Fonts load from Google Fonts, so they need internet; otherwise a standard font is used.
