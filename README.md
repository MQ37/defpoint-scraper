# defpoint-scraper

Apify Actor that scrapes drone spare parts from [defpoint.ua](https://defpoint.ua/en/drony-ta-zapchastyny/zapchastyny-dlya-droniv).

## What it scrapes

Crawls the Spare Parts for Drones category on defpoint.ua and extracts structured product data: name, SKU, brand, price (UAH), stock availability, full description with specifications, and product images.

## Quick start

```bash
pnpm install
pnpm dev         # watch mode with tsx
pnpm build       # compile TypeScript
pnpm start       # run compiled output
```

## Input

```json
{
  "startUrls": [
    { "url": "https://defpoint.ua/en/drony-ta-zapchastyny/zapchastyny-dlya-droniv" }
  ],
  "maxProducts": 0
}
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `startUrls` | array | — | Category URLs to scrape |
| `maxProducts` | number | `0` (unlimited) | Max products to extract |

## Output schema

```json
{
  "url": "string",
  "name": "string",
  "sku": "string | null",
  "brand": "string | null",
  "price": "number | null (UAH)",
  "stock": "'in stock' | 'out of stock' | null",
  "description": "string | null",
  "images": ["string (URL)"],
  "breadcrumbs": ["string"],
  "scrapedAt": "ISO 8601 date"
}
```

## Site structure

defpoint.ua runs on OpenCart with server-rendered HTML. Category pages list products with pagination. Product detail pages contain specifications, pricing, and stock status in static markup — no browser rendering required.

## Tech stack

- **Crawlee** — CheerioCrawler
- **Cheerio** — HTML parsing
- **Apify SDK** — Actor lifecycle + dataset storage
- Node.js 22+
