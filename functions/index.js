
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






exports.addNewData = functions.https.onRequest(async (req, res) => {
    try {
        // Firestoreコレクションを参照
        const collectionRef = admin.firestore().collection('podcasts');

        // データを作成
        const newData = {
            headline: 'Fantasy 606 podcast: Free hit fishing across the pond',
            url: 'https://www.bbc.co.uk/sounds/play/p0f90zph',
        };

        // Firestoreにデータを登録
        const docRef = await collectionRef.add(newData);
        const data = await docRef.get();
        res.send(`Data added with ID: ${docRef.id} -> ${JSON.stringify(data.data())}`);
    } catch (error) {
        console.log(error);
        res.status(500).send('Error adding data');
    }
});