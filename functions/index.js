
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

exports.fetchAndSaveResults = functions.https.onRequest(async (req, res) => {
    const url = 'https://api-football-v1.p.rapidapi.com/v3/fixtures?league=39&season=2023';
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': '5306d81378msh9bc45e675c00cb3p14a5fajsnef007b957620',
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com'
      }
    };
  
    try {
      const response = await fetch(url, options);
      const result = await response.json();
      const fixtureData = result.response;
  
      const fixtureInfos = [];
  
      // fixtureDataの各要素をループして情報を抽出
      fixtureData.forEach(fixture => {
        // 試合時間の情報を抽出
        const kickoffTime = fixture.fixture.date;
        const duration = fixture.fixture.status.elapsed;
  
        // チームとスコア、アイコン、試合時間の情報を抽出
        const fixtureInfo = {
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          homeTeamLogo: fixture.teams.home.logo,
          awayTeamLogo: fixture.teams.away.logo,
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          kickoffTime: kickoffTime,
          duration: duration
        };
  
        // 抽出した情報を配列に追加
        fixtureInfos.push(fixtureInfo);
      });
  
      // データをFirestoreに保存する
      await admin.firestore().collection('matchResults').doc('2023').set({ fixtures: fixtureInfos });
  
      res.status(200).send('Match results fetched and saved successfully!');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching and saving match results');
    }
  });
  