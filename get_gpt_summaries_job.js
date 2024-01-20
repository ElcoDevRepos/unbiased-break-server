const admin = require("firebase-admin");
const fetch = require("node-fetch");
const axios = require('axios'); // Added axios module
var cron = require("node-cron");
const stringSimilarity = require('string-similarity');
var serviceAccount = require("./serviceAccountKey.json");
require("dotenv").config();

const openai = require("openai");

const api = new openai.OpenAI({
  apiKey: process.env.MY_SECRET_KEY,
});

const PORT = process.env.PORT || 8081;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Added imageArray

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateImage(text) {
  try {
    await sleep(5500);
    const apiUrl = 'https://api.openai.com/v1/images/generations';
    const apiKey = process.env.MY_SECRET_KEY;

    const response = await axios.post(apiUrl, { prompt: text }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const imageUrl = response.data.data[0].url;
    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error.message);
    console.error('Error stack:', error.stack);
  }
}

async function getGPTSummaries() {
  console.log("RUNNING GPT SUMMARIES...");

  const timestampFrame = new Date(Date.now() - 24 * 60 * 60 * 1000); //Timestamp for the timeframe of reads

  const queryTrendingArticles = await db
    .collection("trending-articles")
    .where("timestamp", ">=", timestampFrame)
    .get();

  // Run all trending articles through findPriorityArticles() to remove multiple
  // articles of the same topic.
  const prioritizedArticles = findPriorityArticles(queryTrendingArticles);

  // Local array to save the summaries
  let summariesArray = [];

  const promises = prioritizedArticles.map(async (doc) => {
    let txt = doc.data().textBody; //Grabs reference for the document text body
    let timestamp = doc.data().date; //Grabs reference for the document timestamp
    let source = doc.data().siteName; //Grabs reference for the document source
    let title = doc.data().title; //Grabs reference for the document title
    let link = doc.data().link; //Grabs reference for the document link
    let id = doc.data().id; //Grabs reference for the document id
    let image = null;

    txt = removeDoubleSpaces(txt);

    const MAX_TOKENS = 4090;
    const ESTIMATED_CHAR_PER_TOKEN = 5; // This is a rough estimate

    if (txt.length > MAX_TOKENS * ESTIMATED_CHAR_PER_TOKEN) {
      txt = txt.substring(0, MAX_TOKENS * ESTIMATED_CHAR_PER_TOKEN) + "..."; // Add ellipsis to indicate truncation
    }
    //Prevent Washington Post articles from summary
    if (source != "The Washington Post") {
      try {
        const chatCompletion = await api.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: generatePrompt(txt) }],
        });

        const response = chatCompletion.choices[0].message.content;

        if (doc.data().image != null) image = doc.data().image;
        else (image = await generateImage(response)); //Grabs reference for the document image if there is one

        // Save the summary to the local array instead of firestore directly
        summariesArray.push({
          summary: response,
          timestamp: timestamp,
          source: source,
          title: title,
          image: image,
          link: link,
          id: id,
        });

        // Generate image for the current article
      } catch (err) {
        console.log(err);
      }
    }
  });

  await Promise.all(promises);

  // Save the local array of summaries to one Firestore document
  try {
    await db.collection("gpt-summaries").add({
      summaries: summariesArray,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.log("Error saving summaries to Firestore:", error);
  }

  console.log("GPT SUMMARIES COMPLETE!");
}

// Prioritize articles by removing articles with the same topic and only push
// the article with an image attached.
function findPriorityArticles(articles) {

  let processedIndices = new Set();
  let uniqueArticlesMap = {};

  articles.docs.forEach((doc, index) => {
    if (processedIndices.has(index)) return; // Skip if already processed

    const articleTitle = doc.data().title;
    let hasImage = doc.data().image != null;
    let selectedArticle = doc;

    articles.docs.forEach((d, i) => {
      if (index === i) return; // Skip the same article

      const similarityScore = twoStringSimilarity(articleTitle, d.data().title);
      if (similarityScore > 0.4 && similarityScore != 1) {
        // Similarity found!
        processedIndices.add(i); // Mark as processed
        let comparisonArticleHasImage = d.data().image != null;

        if (comparisonArticleHasImage && !hasImage) {
          // Prefer the article with an image
          selectedArticle = d;
          hasImage = true; // Update the flag as we now have an image
        }
      }
    });

    // Store the preferred article in the uniqueArticlesMap
    uniqueArticlesMap[articleTitle] = selectedArticle;
  });

  // Convert the map to an array of unique articles, preferring those with images
  let uniqueArticles = Object.values(uniqueArticlesMap);
  return uniqueArticles;
}

// Two string similarity check using "string-similarity"
// Returns a score between 0 and 1 to determine similarity
function twoStringSimilarity(text1, text2) {
  const similarity = stringSimilarity.compareTwoStrings(text1, text2);
  return similarity;
}

function generatePrompt(textBody) {
  return `Create a two-sentence summary for this news article: ${textBody}`;
}

function removeDoubleSpaces(inputString) {
  return inputString.replace(/\s{2,}/g, " ");
}

function init() {
  Promise.all([getGPTSummaries()]).then(() => process.exit());
}

init();

module.exports = { getGPTSummaries };
