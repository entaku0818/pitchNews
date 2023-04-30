

# OverView
This script is a Firebase Cloud Function that responds to HTTP requests. It uses Puppeteer and node-fetch to scrape football news from the BBC Sports website. The scraped news headlines, images, URLs, and summaries are stored in Firestore using the Firebase Admin SDK.

このスクリプトは、HTTPリクエストに応答するFirebase Cloud Functionです。Puppeteerとnode-fetchを使用して、BBCスポーツのウェブサイトからフットボールのニュースをスクレイピングします。スクレイピングしたニュースの見出し、画像URL、URL、サマリーはFirebase Admin SDKを使用してFirestoreに保存されます。


# テスト方法

```zsh
firebase emulators:start --only functions
```
これのあとで下記URLを叩く
http://localhost:5001/the-pitch-post/us-central1/scrapeGoogle

# deploy方法
- 下記のコマンドでとりあえずデプロイできるようにしている
```zsh
firebase deploy --only functions
```


