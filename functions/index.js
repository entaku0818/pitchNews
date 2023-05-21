
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
                const imgElement = news.querySelector('img[srcset]');
                const img = imgElement ? imgElement.srcset.split(' ')[0] : null;
                const url = news.querySelector('a[href]').href;
                const summaryElement = news.querySelector('.gs-c-promo-summary');
                const summary = summaryElement ? summaryElement.textContent : null;

                if (!imgElement) {
                    return null; // 画像がない場合はnullを返す
                }

                return { headline, img, url, summary };
            }).filter(news => news !== null); // nullの要素を除外する
        });

        console.log(news);

        // ブラウザを閉じる
        await browser.close();

        // Firestoreにデータを登録する
        await addNewData(news,"www.bbc.com");

        res.status(200).send(news);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error scraping data');
    }
});

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

