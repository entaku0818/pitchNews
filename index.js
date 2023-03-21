
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

    await page.goto('https://www.bbc.com/sport/football', { waitUntil: 'networkidle2' });

    // ニュースの見出しと画像URLを取得する
    const news = await page.$$eval('.gs-c-promo', newsList => {
        return newsList.map(news => {
            const headline = news.querySelector('.gs-c-promo-heading__title').textContent;
            const img = news.querySelector('img[srcset]') ? news.querySelector('img[srcset]').srcset.split(' ')[0] : null;
            const url = news.querySelector('a[href]').href;
            const summary = news.querySelector('.gs-c-promo-summary') ? news.querySelector('.gs-c-promo-summary').textContent : null;

            return { headline, img, url,summary };
        });
    });


    console.log(news);

    // ブラウザを閉じる
    await browser.close();
    res.status(200).send(news);
};






