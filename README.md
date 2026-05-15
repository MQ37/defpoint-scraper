# defpoint-scraper

Apify Actor to scrape drone spare parts from [defpoint.ua](https://defpoint.ua/en/drony-ta-zapchastyny/zapchastyny-dlya-droniv).

## What it does

Crawls the Spare Parts for Drones category on defpoint.ua and extracts structured product data:
- Product name, SKU, brand
- Price (UAH)
- Stock availability
- Full description with specifications
- Product images (deduplicated, full-resolution)

## Stack

- **Crawlee** + CheerioCrawler (no browser needed)
- Node.js 22+

## Usage

```bash
pnpm install
pnpm start
```

Output is stored in `storage/datasets/default/` as JSON files.

## Scraping target

| Detail | Value |
|---|---|
| Site | https://defpoint.ua |
| Category | `/en/drony-ta-zapchastyny/zapchastyny-dlya-droniv` |
| Pages | 3 (24 products/page) |
| Total products | ~51 |
| Tech | OpenCart, static HTML |

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
