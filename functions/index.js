
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

                return { headline, img, url, summary };
            });
        });

        console.log(news);

        // ブラウザを閉じる
        await browser.close();

        // Firestoreにデータを登録する
        await addNewData(news);

        res.status(200).send(news);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error scraping data');
    }
});

async function addNewData(news) {
    try {
        // Firestoreコレクションを参照
        const collectionRef = admin.firestore().collection('books');

        // Firestoreにデータを登録
        const promises = news.map(async (article) => {
            const docRef = await collectionRef.add({
                title: article.headline,
                imageUrl: article.img,
                url: article.url,
                description: article.summary,
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

                return { headline, img, url, summary };
            });
        });

        console.log(news);

        // ブラウザを閉じる
        await browser.close();

        // Firestoreにデータを登録する
        await addNewData(news);


    } catch (error) {
        console.error(error);
        throw new functions.https.HttpsError('unknown', error.toString());
    }
});

exports.testScrapeGooglePubSub = functions.https.onRequest(async (req, res) => {

    try {
        // テスト用のPub/Subメッセージを作成してトリガーを呼び出す
        await exports.scrapeGooglePubSub("");

        res.status(200).send('Pub/Sub function triggered successfully.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error triggering Pub/Sub function.');
    }
});