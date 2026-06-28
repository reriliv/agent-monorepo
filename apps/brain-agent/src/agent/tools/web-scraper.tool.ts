import { tool } from 'langchain';
import z from 'zod';

export const webScraperTool = tool(
  async ({ url, selector }) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      if (selector) {
        const cheerio = await import('cheerio');
        const $ = cheerio.load(html);
        const elements = $(selector);
        const results: string[] = [];

        elements.each((_, el) => {
          results.push($(el).text().trim());
        });

        return results.length > 0 ? results.join('\n') : `No elements found with selector: ${selector}`;
      }

      const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n+/g, '\n')
        .trim();

      return textContent.substring(0, 5000);
    } catch (error) {
      return `Error scraping webpage: ${(error as Error).message}`;
    }
  }, {
    name: 'web-scraper',
    description: 'Scrapes a web page and extracts text content. Optionally uses CSS selector to extract specific elements.',
    schema: z.object({
      url: z.string().describe('The URL of the webpage to scrape.'),
      selector: z.string().optional().describe('CSS selector to extract specific elements. If not provided, extracts all text content.'),
    }),
  });
