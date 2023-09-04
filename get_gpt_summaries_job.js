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
    console.log("RUNNING GPT SUMMARIES...");

    const timestampFrame = new Date(Date.now() - 24 * 60 * 60 * 1000); //Timestamp for the timeframe of reads

    const queryTrendingArticles = await db.collection("trending-articles").where("timestamp", ">=", timestampFrame).get();

    // Local array to save the summaries
    let summariesArray = [];

    const promises = queryTrendingArticles.docs.map(async (doc) => {
        let txt = doc.data().textBody; //Grabs reference for the document text body
        let timestamp = doc.data().date; //Grabs reference for the document timestamp
        let source = doc.data().siteName; //Grabs reference for the document source
        let title = doc.data().title; //Grabs reference for the document title
        let link = doc.data().link; //Grabs reference for the document link
        let id = doc.data().id; //Grabs reference for the document id
        let image = null;
        if(doc.data().image != null) image = doc.data().image; //Grabs reference for the document image if there is one
        txt = removeDoubleSpaces(txt);
        try {
            const chatCompletion = await api.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{"role": "user", "content": generatePrompt(txt)}],
            });

            const response = chatCompletion.choices[0].message.content;

            // Save the summary to the local array instead of firestore directly
            summariesArray.push({
                summary: response,
                timestamp: timestamp,
                source: source,
                title: title,
                image: image,
                link: link,
                id: id
            });

        } catch (err) {
            console.log(err);
        }
    });

    await Promise.all(promises);

    // Save the local array of summaries to one Firestore document
    try {
        await db.collection('gpt-summaries').add({
            summaries: summariesArray,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.log("Error saving summaries to Firestore:", error);
    }

    console.log("GPT SUMMARIES COMPLETE!")
}

function generatePrompt(textBody) {
    return `Create a two sentence summary for this news article: ${textBody}`;
}

function removeDoubleSpaces(inputString) {
    return inputString.replace(/\s{2,}/g, ' ');
}

function init() {
    Promise.all([getGPTSummaries()]).then(() => process.exit());
}

init();
