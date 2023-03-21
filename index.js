
/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const fetch = require('node-fetch');

const puppeteer = require('puppeteer');

exports.scrapeGoogle = async (req, res) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.google.com');
    const title = await page.title();
    await browser.close();
    res.status(200).send(title);
};






