
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
            id: fixture.fixture.id,
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
      await admin.firestore()
      .collection('matchResults')
      .doc("39") 
      .set({ "2023_2024": fixtureInfos });
        
      res.status(200).send('Match results fetched and saved successfully!');
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching and saving match results');
    }
  });
  

  exports.fetchAndSaveYouTubeResults = functions.https.onRequest(async (req, res) => {
    const playlistItemId = "PLDfB2rHFTxIv2VwVZVJ-lAP-SpoMf1zfM";
    const apiKey = "AIzaSyAMrtky6JDeKjTSCq4hqRFNeO1pFpGheSM"; 

    const apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${playlistItemId}&maxResults=100&key=${apiKey}&part=snippet,contentDetails`;

    try {
        const response = await fetch(apiUrl);
        const result = await response.json();

        // Check if the result contains items
        if (result.items && result.items.length > 0) {
            const playlistItems = result.items;

            // Iterate through each playlist item and save to Firestore
            for (const playlistItem of playlistItems) {
                const videoId = playlistItem.snippet.resourceId.videoId;
                const videoPublishedAt = playlistItem.contentDetails.videoPublishedAt;

                await admin.firestore().collection('youtubeVideos').doc(videoId).set({
                    videoId: videoId,
                    publishedAt: videoPublishedAt
                });
            }

            res.status(200).send('YouTube video data fetched and saved successfully!');
        } else {
            res.status(404).send('No YouTube playlist items found.');
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching and saving YouTube video data');
    }
});



exports.fetchAndSaveFixtureStatistics = functions.https.onRequest(async (req, res) => {
    // FirestoreからすべてのfixtureIdを取得
    const docRef = admin.firestore().collection('matchResults').doc("39");
    const doc = await docRef.get();

    if (!doc.exists) {
      res.status(404).send('No document found.');
    } else {
      // ドキュメントが存在する場合、必要なデータを抽出
      const data = doc.data();
      const fixtureInfos = data["2023-2024"]; // 2023-2024 シーズンのデータを取得
      const fixtureIds = fixtureInfos.map(f => f.id); // fixtureIdsを抽出

      for (let fixtureId of fixtureIds) {
        fixtureId = String(fixtureId);

        const url = `https://api-football-v1.p.rapidapi.com/v3/fixtures/statistics?fixture=${fixtureId}`;
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
            if (!result.response || result.response.length === 0) {
                throw new Error('No statistics data found for fixture ID: ' + fixtureId);
            }

            const statisticsInfos = result.response.map(teamStat => {
                if (!teamStat.team || !teamStat.statistics) {
                    throw new Error('Invalid data structure for team statistics');
                }

                return {
                    teamId: teamStat.team.id,
                    teamName: teamStat.team.name,
                    teamLogo: teamStat.team.logo,
                    statistics: teamStat.statistics.map(stat => ({
                        type: stat.type,
                        value: stat.value !== null ? stat.value : "N/A"  // Handling null values
                    }))
                };
            });

            await admin.firestore().collection('fixtureStatistics').doc(fixtureId).set({ teams: statisticsInfos });
        } catch (error) {
            console.error('Error fetching or processing data for fixture:', fixtureId, error);
            return res.status(500).send('Error processing fixture ID ' + fixtureId + ': ' + error.message);
        }
    }
    }

    // 各fixtureIdに対して統計を取得し保存


    res.status(200).send('All fixture statistics fetched and saved successfully!');
});
