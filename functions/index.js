
/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const fetch = require('node-fetch');

const puppeteer = require('puppeteer');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);
exports.scrapeGoogle = functions.https.onRequest(async (req, res) => {
    try {
        const newsBBC = await scrapeNews();
        const newsSoccerKing = await scrapeSoccerKing();

        const combinedNews = newsBBC.concat(newsSoccerKing);



        res.status(200).send(combinedNews);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error scraping data');
    }
});

async function scrapeNews() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto('https://www.bbc.com/sport/football', { waitUntil: 'networkidle2' });

        const news = await page.$$eval('.gs-c-promo', newsList => {
            return newsList.map(news => {
                const headline = news.querySelector('.gs-c-promo-heading__title').textContent;
                const imgElement = news.querySelector('img[srcset]');
                const img = imgElement ? imgElement.srcset.split(' ')[0] : null;
                const url = news.querySelector('a[href]').href;
                const summaryElement = news.querySelector('.gs-c-promo-summary');
                const summary = summaryElement ? summaryElement.textContent : null;

                if (!imgElement) {
                    return null;
                }

                return { headline, img, url, summary };
            }).filter(news => news !== null);
        });
        await addNewData(news, "www.bbc.com");
        return news;
    } finally {
        await page.close();
        await browser.close();
    }
}

async function scrapeSoccerKing() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
        await page.goto('https://www.soccer-king.jp/news/world', { waitUntil: 'networkidle2' });

        const news = await page.$$eval('.article_list.list_clm-listpage li', newsList => {
            return newsList.map(news => {
                const headline = news.querySelector('.tit').textContent;
                const imgElement = news.querySelector('.img_box .img');
                const img = imgElement ? imgElement.style.backgroundImage.match(/url\((.*?)\)/)[1].replace(/['"]+/g, '') : null;
                const url = news.querySelector('a').href;
                const category = news.querySelector('.cate').textContent;
                const author = news.querySelector('.outh').textContent;
                const summary = news.querySelector('.tit').textContent;


                return { headline, img, url, summary, category, author };
            }).filter(news => news !== null);
        });

        await addNewData(news, "www.soccer-king.jp");
        console.log("www.soccer-king.jp", news);
        return news;
    } finally {
        await page.close();
        await browser.close();
    }
}


async function addNewData(news, sourceSite) {
    try {
        // Firestoreコレクションを参照
        const collectionRef = admin.firestore().collection('books');

        // Firestoreにデータを登録
        const promises = news.map(async (article) => {
            const url = article.url;

            // 既に同じURLが登録されているかチェックする
            const existingDoc = await collectionRef.where('url', '==', url).limit(1).get();
            if (!existingDoc.empty) {
                console.log(`URL already exists, skipping: ${url}`);
                return;
            }

            const docRef = await collectionRef.add({
                title: article.headline,
                imageUrl: article.img,
                url: url,
                description: article.summary,
                sourceSite: sourceSite,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const data = await docRef.get();
            console.log(`Data added with ID: ${docRef.id} -> ${JSON.stringify(data.data())}`);
        });

        await Promise.all(promises);
    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('unknown', 'Error adding data');
    }
}

exports.scrapeGooglePubSub = functions.pubsub.topic('my-topic').onPublish(async (message) => {

    try {
        const newsBBC = await scrapeNews();
        const newsSoccerKing = await scrapeSoccerKing();

        const combinedNews = newsBBC.concat(newsSoccerKing);
        console.log(combinedNews);

    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('unknown', error.toString());
    }
});

