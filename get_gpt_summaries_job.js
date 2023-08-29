const admin = require("firebase-admin");
const fetch = require("node-fetch");
var cron = require('node-cron');
var serviceAccount = require("./serviceAccountKey.json");
require('dotenv').config();

const openai = require('openai'); 

const api = new openai.OpenAI({
    apiKey: process.env.MY_SECRET_KEY
});

const PORT = process.env.PORT || 8081
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function getGPTSummaries() {
    console.log("RUNNING...");

    const timestampFrame = new Date(Date.now() - 24 * 60 * 60 * 1000); //Timestamp for the timeframe of reads

    const queryTrendingArticles = await db.collection("trending-articles").where("timestamp", ">=", timestampFrame).get();

    const promises = queryTrendingArticles.docs.map(async (doc) => {
        let txt = doc.data().textBody; //Grabs reference for the document text body
        txt = removeDoubleSpaces(txt);

        try {
            const chatCompletion = await api.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{"role": "user", "content": generatePromt(txt)}],
            });

            const response = chatCompletion.choices[0].message.content;
            console.log(response);

            // Save the summary to firebase firestore
            return db.collection('gpt-summaries').add({
                summary: response,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (err) {
            console.log(err);
        }
    });

    await Promise.all(promises);
}

function generatePromt(textBody) {
    return `Create a two sentence summary for this news article: ${textBody}`;
}

function removeDoubleSpaces(inputString) {
    return inputString.replace(/\s{2,}/g, ' ');
}

function init() {
    Promise.all([getGPTSummaries()]).then(() => process.exit());
}

init();
