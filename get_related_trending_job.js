const admin = require("firebase-admin");
const fetch = require("node-fetch");
var serviceAccount = require("./serviceAccountKey.json");

const stringSimilarity = require("string-similarity");

const PORT = process.env.PORT || 8081
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

let baseURL = "https://url-content-extractor.p.rapidapi.com/";
const options = {
    method: "GET",
    headers: {
        "X-RapidAPI-Key": "3b3d59a4b1msh9fe345204a200d6p1bf9cdjsnbc7461a03162",
        "X-RapidAPI-Host": "url-content-extractor.p.rapidapi.com"
    }
};

async function getRelatedArticles () {
    console.log("RUNNING...");

    const timestampFrame = new Date(Date.now() - 48 * 60 * 60 * 1000);     //Timestamp for the timeframe of reads
    const minimumSimilarity = 0.7;                                         //Minimum value of similarity to determine if two articles are similar

    //Get a query reference snapshot from the last 24h for left, middle and right articles
    const queryTrendingArticles = await db.collection("trending-articles").where("date", ">=", timestampFrame).get();

    const promises = [];

    //Go through all queried articles
    queryTrendingArticles.forEach((doc) => {
        const id = doc.data().id;
        const textBody = doc.data().textBody;   //Grabs reference for the document text body 
        let relatedArticles = [];               //A place to temporary store the related articles

        queryTrendingArticles.forEach((d) => {
            const data = d.data();

            //Make sure topic matches and it's not deleted
            if(data.id != id && data.deleted == false) {
                
                //Run a similarity check on the two bodies of text
                const similarity = stringSimilarity.compareTwoStrings(textBody, data.textBody);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                    relatedArticles.push(d.id);   //Add the article to the related articles
                }
            }
        });

        const updatePromise = doc.ref.set({
            "related_articles": relatedArticles
        }, { merge: true })
        .then(() => {
            console.log('Field added successfully!');
        })
        .catch((error) => {
            console.error('Error adding field: ', error);
        });

        promises.push(updatePromise);
    });

    await Promise.all(promises);
}

function init() {
    Promise.all([getRelatedArticles()]).then(() => process.exit());
}

init();