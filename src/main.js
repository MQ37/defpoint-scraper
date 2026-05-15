import { CheerioCrawler } from 'crawlee';
import { Actor } from 'apify';

const CATEGORY_URL = 'https://defpoint.ua/en/drony-ta-zapchastyny/zapchastyny-dlya-droniv';
const BASE_URL = 'https://defpoint.ua';

await Actor.init();

const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: 300,

    async requestHandler({ request, $, log }) {
        const { label } = request.userData;

        if (label === 'CATEGORY') {
            log.info(`Category page: ${request.url}`);

            // Extract product URLs from the listing (exclude pagination links)
            const productLinks = [];
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('/zapchastyny-dlya-droniv/')
                    && !href.endsWith('/zapchastyny-dlya-droniv')
                    && !href.includes('?page=')
                    && !href.includes('#') ) {
                    const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                    productLinks.push(fullUrl);
                }
            });

            const uniqueLinks = [...new Set(productLinks)];
            log.info(`Found ${uniqueLinks.length} products`);

            for (const url of uniqueLinks) {
                await crawler.addRequests([{ url, userData: { label: 'PRODUCT' } }]);
            }

            // Pagination - enqueue numbered pages
            const pageUrls = [];
            $('.pagination a').each((_, el) => {
                const href = $(el).attr('href');
                const text = $(el).text().trim();
                if (href && /^\d+$/.test(text)) {
                    const pageUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                    if (!pageUrls.includes(pageUrl)) pageUrls.push(pageUrl);
                }
            });
            for (const url of pageUrls) {
                await crawler.addRequests([{ url, userData: { label: 'CATEGORY' } }]);
            }
        }

        if (label === 'PRODUCT') {
            log.info(`Product: ${request.url}`);

            const name = $('h1').first().text().trim();

            // SKU: find in body text
            const bodyText = $('body').text();
            const skuMatch = bodyText.match(/Product Code:\s*(\d+)/);
            const sku = skuMatch ? skuMatch[1] : null;

            // Brand: find text node after "Brand:"
            const brandMatch = bodyText.match(/Brand:\s+(\S[^\n]{0,40})/);
            const brand = brandMatch ? brandMatch[1].trim() : null;

            // Price: look for sc-module-price element
            const priceText = $('.sc-module-price, [class*="product-price"], .price-new').first().text().trim();
            const priceNum = priceText.replace(/[^\d]/g, '');
            const priceValue = priceNum ? parseInt(priceNum, 10) : null;

            // Stock
            const stock = bodyText.match(/in stock/i) ? 'in stock'
                : bodyText.match(/out of stock/i) ? 'out of stock'
                : null;

            // Description
            let descEl = ($('[class*="description"]').first().text().trim()
                || $('#tab-description').text().trim())
                .replace(/\s*Description\s*/i, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            // Product images only - prefer large versions, deduplicate
            const imageSet = new Set();
            const images = [];
            const addImage = (src) => {
                if (!src || src.includes('logo') || src.includes('icon')) return;
                const url = src.startsWith('http') ? src : `${BASE_URL}${src}`;
                // Normalize to 1500x1500 version
                const normalized = url.replace(/-\d+x\d+/, '-1500x1500');
                if (!imageSet.has(normalized)) {
                    imageSet.add(normalized);
                    images.push(normalized);
                }
            };
            $('.product-image img, .thumbnails img, a.thumbnail img').each((_, el) => {
                addImage($(el).attr('src') || $(el).attr('data-src'));
            });
            // Fallback
            if (images.length === 0) {
                $('img[src*="/catalog/zapchastini"]').each((_, el) => {
                    addImage($(el).attr('src'));
                });
            }

            // Breadcrumbs
            const breadcrumbs = $('.breadcrumb a[href]').map((_, el) => $(el).text().trim()).get();

            await Actor.pushData({
                url: request.url,
                name,
                sku,
                brand,
                price: priceValue,
                stock,
                description: descEl || null,
                images,
                breadcrumbs,
                scrapedAt: new Date().toISOString(),
            });
        }
    },

    failedRequestHandler({ request, log }) {
        log.error(`Request ${request.url} failed.`);
    },
});

await crawler.run([
    { url: CATEGORY_URL, userData: { label: 'CATEGORY' } },
]);

await Actor.exit();
