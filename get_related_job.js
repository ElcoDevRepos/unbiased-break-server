const admin = require("firebase-admin");
const fetch = require("node-fetch");
var cron = require('node-cron');
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

async function start() {

    const yesterday = new Date(Date.now() - 5 * 60 * 60 * 1000);    //Timestamp for 24h ago
    const minimumSimilarity = 0.5;                                  //Minimum value of similarity to determine if two articles are similar

    //Get a query reference snapshot from the last 24h for left, middle and right articles
    const queryLeftArticles = await db.collection("left-articles").where("timestamp", ">=", yesterday).get();
    const queryMiddleArticles = await db.collection("middle-articles").where("timestamp", ">=", yesterday).get();
    const queryRightArticles = await db.collection("right-articles").where("timestamp", ">=", yesterday).get();


    queryLeftArticles.forEach((doc) => {
        const topic = doc.data().topic;         //Grabs reference for the document topic
        const textBody = doc.data().textBody;   //Grabs reference for the document text body 
        let relatedArticles = [];               //A place to temporary store the related articles

        //Go through all the middle articles to find related ones
        queryMiddleArticles.forEach((d) => {
            const data = d.data();

            //Make sure topic matches and it's not deleted
            if(data.topic == topic && data.deleted == false) {
                
                //Run a similarity check on the two bodies of text
                const similarity = stringSimilarity.compareTwoStrings(textBody, data.textBody);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                    relatedArticles.push(data.title);   //Add the article to the related articles
                }
            }
        });

        //Go through all right articles to find related ones
        queryRightArticles.forEach((d) => {
            const data = d.data();

            //Make sure topic matches and it's not deleted
            if(data.topic == topic && data.deleted == false) {
                
                //Run a similarity check on the two bodies of text
                const similarity = stringSimilarity.compareTwoStrings(textBody, data.textBody);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                    relatedArticles.push(data.title);   //Add the article to the related articles
                }
            }
        });

        console.log(doc.data().title, ": ", relatedArticles);
    });
};

function init() {
    Promise.all([start()]).then(() => process.exit());
}

init();