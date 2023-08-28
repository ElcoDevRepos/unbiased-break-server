const admin = require("firebase-admin");
const fetch = require("node-fetch");
var cron = require('node-cron');
var serviceAccount = require("./serviceAccountKey.json");

const OpenAIApi = require("openai").OpenAIApi;
const Configuration = require("openai").Configuration;

const configuration = new Configuration({
  apiKey: "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",
});
const openai = new OpenAIApi(configuration);

const PORT = process.env.PORT || 8081
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function getGPTSummaries () {
    console.log("RUNNING...");

    const timestampFrame = new Date(Date.now() - 24 * 60 * 60 * 1000);     //Timestamp for the timeframe of reads

    const queryTrendingArticles = await db.collection("trending-articles").where("timestamp", ">=", timestampFrame).get();

    const promises = [];
    let i = 0;

    queryTrendingArticles.forEach((doc) => {
        const title = doc.data().title;         //Grabs reference for the document title
        i++;
        console.log(i, ": ", title);
    });

    await Promise.all(promises);
}

function init() {
    Promise.all([getGPTSummaries()]).then(() => process.exit());
}

init();