import { CheerioCrawler, type CheerioCrawlingContext } from 'crawlee';
import { Actor } from 'apify';

interface ProductData {
    url: string;
    name: string;
    sku: string | null;
    brand: string | null;
    price: number | null;
    stock: 'in stock' | 'out of stock' | null;
    description: string | null;
    images: string[];
    breadcrumbs: string[];
    scrapedAt: string;
}

type CrawlerLabel = 'CATEGORY' | 'PRODUCT';

interface CrawlerUserData {
    label: CrawlerLabel;
}

const CATEGORY_URL = 'https://defpoint.ua/en/drony-ta-zapchastyny/zapchastyny-dlya-droniv';
const BASE_URL = 'https://defpoint.ua';

type Cheerio$ = CheerioCrawlingContext['$'];

function extractProductLinks($: Cheerio$): string[] {
    const links: string[] = [];
    $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (
            href &&
            href.includes('/zapchastyny-dlya-droniv/') &&
            !href.endsWith('/zapchastyny-dlya-droniv') &&
            !href.includes('?page=') &&
            !href.includes('#')
        ) {
            links.push(href.startsWith('http') ? href : `${BASE_URL}${href}`);
        }
    });
    return [...new Set(links)];
}

function extractPageNumbers($: Cheerio$): string[] {
    const pages: string[] = [];
    $('.pagination a').each((_, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && /^\d+$/.test(text)) {
            const pageUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
            if (!pages.includes(pageUrl)) pages.push(pageUrl);
        }
    });
    return pages;
}

function extractProduct($: Cheerio$, url: string): ProductData {
    const name = $('h1').first().text().trim();
    const bodyText = $('body').text();

    // SKU
    const skuMatch = bodyText.match(/Product Code:\s*(\d+)/);
    const sku = skuMatch ? skuMatch[1] : null;

    // Brand
    const brandMatch = bodyText.match(/Brand:\s+(\S[^\n]{0,40})/);
    const brand = brandMatch ? brandMatch[1].trim() : null;

    // Price
    const priceText = $('.sc-module-price, [class*="product-price"], .price-new')
        .first()
        .text()
        .trim();
    const priceNum = priceText.replace(/[^\d]/g, '');
    const priceValue = priceNum ? parseInt(priceNum, 10) : null;

    // Stock
    const stock = bodyText.match(/in stock/i)
        ? ('in stock' as const)
        : bodyText.match(/out of stock/i)
          ? ('out of stock' as const)
          : null;

    // Description
    const description = (
        $('[class*="description"]').first().text().trim() ||
        $('#tab-description').text().trim()
    )
        .replace(/\s*Description\s*/i, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim() || null;

    // Images
    const imageSet = new Set<string>();
    const images: string[] = [];

    const addImage = (src: string | undefined): void => {
        if (!src || src.includes('logo') || src.includes('icon')) return;
        const url = src.startsWith('http') ? src : `${BASE_URL}${src}`;
        const normalized = url.replace(/-\d+x\d+/, '-1500x1500');
        if (!imageSet.has(normalized)) {
            imageSet.add(normalized);
            images.push(normalized);
        }
    };

    $('.product-image img, .thumbnails img, a.thumbnail img').each((_, el) => {
        addImage($(el).attr('src') || $(el).attr('data-src'));
    });

    if (images.length === 0) {
        $('img[src*="/catalog/zapchastini"]').each((_, el) => {
            addImage($(el).attr('src'));
        });
    }

    // Breadcrumbs
    const breadcrumbs = $('.breadcrumb a[href]')
        .map((_, el) => $(el).text().trim())
        .get();

    return {
        url,
        name,
        sku,
        brand,
        price: priceValue,
        stock,
        description,
        images,
        breadcrumbs,
        scrapedAt: new Date().toISOString(),
    };
}

await Actor.init();

const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: 300,

    async requestHandler({ request, $, log }: CheerioCrawlingContext) {
        const { label } = request.userData as CrawlerUserData;

        if (label === 'CATEGORY') {
            log.info(`Category page: ${request.url}`);

            const productLinks = extractProductLinks($);
            log.info(`Found ${productLinks.length} products`);

            for (const url of productLinks) {
                await crawler.addRequests([
                    { url, userData: { label: 'PRODUCT' as const } },
                ]);
            }

            const pageUrls = extractPageNumbers($);
            for (const url of pageUrls) {
                await crawler.addRequests([
                    { url, userData: { label: 'CATEGORY' as const } },
                ]);
            }
        }

        if (label === 'PRODUCT') {
            log.info(`Product: ${request.url}`);
            const product = extractProduct($, request.url);
            await Actor.pushData(product);
        }
    },

    failedRequestHandler({ request, log }) {
        log.error(`Request ${request.url} failed.`);
    },
});

await crawler.run([
    { url: CATEGORY_URL, userData: { label: 'CATEGORY' as const } },
]);

await Actor.exit();
