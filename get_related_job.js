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

async function getRelatedArticles () {
    console.log("RUNNING...");

    const timestampFrame = new Date(Date.now() - 6 * 60 * 60 * 1000);     //Timestamp for the timeframe of reads
    const minimumSimilarity = 0.55;                                       //Minimum value of similarity to determine if two articles are similar

    //Get a query reference snapshot from the last 24h for left, middle and right articles
    const queryLeftArticles = await db.collection("left-articles").where("timestamp", ">=", timestampFrame).get();
    const queryMiddleArticles = await db.collection("middle-articles").where("timestamp", ">=", timestampFrame).get();
    const queryRightArticles = await db.collection("right-articles").where("timestamp", ">=", timestampFrame).get();

    const promises = [];

    //Find related articles for all left-articles
    queryLeftArticles.forEach((doc) => {
        const title = doc.data().title;         //Grabs reference for the document title
        let relatedArticles = [];               //A place to temporary store the related articles

        //Go through all the middle articles to find related ones
        queryMiddleArticles.forEach((d) => {
            const data = d.data();

            //Make sure it's not deleted
            if(data.deleted == false) {
                
                //Run a similarity check on the two titles
                const similarity = stringSimilarity.compareTwoStrings(title, data.title);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                
                  //Add the article and its similarity score to the related articles
                  relatedArticles.push({id: d.id, similarity: similarity});
                }
            }
        });

        //Go through all right articles to find related ones
        queryRightArticles.forEach((d) => {
            const data = d.data();

           //Make sure it's not deleted
           if(data.deleted == false) {
                
                //Run a similarity check on the two titles
                const similarity = stringSimilarity.compareTwoStrings(title, data.title);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                  
                  //Add the article and its similarity score to the related articles
                  relatedArticles.push({id: d.id, similarity: similarity});
                }
            }
        });

        //Sort the related articles by similarity in descending order
        relatedArticles.sort((a, b) => b.similarity - a.similarity);

        //Create a new array with only the article IDs
        const relatedArticleIds = relatedArticles.map((article) => article.id);


        const updatePromise = doc.ref.update({ "related_articles": relatedArticleIds })
            .then(() => {})
            .catch((error) => {
                console.error('Error updating field: ', error);
        });

        promises.push(updatePromise);
    });

    //Find related articles for all middle-articles
    queryMiddleArticles.forEach((doc) => {
        const title = doc.data().title;         //Grabs reference for the document title
        let relatedArticles = [];               //A place to temporary store the related articles

        //Go through all the middle articles to find related ones
        queryLeftArticles.forEach((d) => {
            const data = d.data();

            //Make sure it's not deleted
            if(data.deleted == false) {
                
                //Run a similarity check on the two titles
                const similarity = stringSimilarity.compareTwoStrings(title, data.title);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {

                    //Add the article and its similarity score to the related articles
                    relatedArticles.push({id: d.id, similarity: similarity});
                }
            }
        });

        //Go through all right articles to find related ones
        queryRightArticles.forEach((d) => {
            const data = d.data();
          
            //Make sure it's not deleted
            if(data.deleted == false) {
          
              //Run a similarity check on the two titles
              const similarity = stringSimilarity.compareTwoStrings(title, data.title);
          
              //Determine if the similarity is above the minimum
              if(similarity >= minimumSimilarity) {
          
                //Add the article and its similarity score to the related articles
                relatedArticles.push({id: d.id, similarity: similarity});
              }
            }
        });
          
        //Sort the related articles by similarity in descending order
        relatedArticles.sort((a, b) => b.similarity - a.similarity);

        //Create a new array with only the article IDs
        const relatedArticleIds = relatedArticles.map((article) => article.id);


        const updatePromise = doc.ref.update({ "related_articles": relatedArticleIds })
            .then(() => {})
            .catch((error) => {
                console.error('Error updating field: ', error);
        });

        promises.push(updatePromise);
    });

    //Find related articles for all right-articles
    queryRightArticles.forEach((doc) => {
        const title = doc.data().title;         //Grabs reference for the document title 
        let relatedArticles = [];               //A place to temporary store the related articles

        //Go through all the middle articles to find related ones
        queryLeftArticles.forEach((d) => {
            const data = d.data();

            //Make sure it's not deleted
            if(data.deleted == false) {
                
                //Run a similarity check on the two titles
                const similarity = stringSimilarity.compareTwoStrings(title, data.title);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                    
                    //Add the article and its similarity score to the related articles
                    relatedArticles.push({id: d.id, similarity: similarity});
                }
            }
        });

        //Go through all right articles to find related ones
        queryMiddleArticles.forEach((d) => {
            const data = d.data();

            //Make sure it's not deleted
            if(data.deleted == false) {
                
                //Run a similarity check on the two titles
                const similarity = stringSimilarity.compareTwoStrings(title, data.title);

                //Determine if the similarity is above the minimum
                if(similarity >= minimumSimilarity) {
                    
                    //Add the article and its similarity score to the related articles
                    relatedArticles.push({id: d.id, similarity: similarity});
                }
            }
        });

        //Sort the related articles by similarity in descending order
        relatedArticles.sort((a, b) => b.similarity - a.similarity);

        //Create a new array with only the article IDs
        const relatedArticleIds = relatedArticles.map((article) => article.id);


        const updatePromise = doc.ref.update({ "related_articles": relatedArticleIds })
            .then(() => {})
            .catch((error) => {
                console.error('Error updating field: ', error);
        });

        promises.push(updatePromise);
    });

    await Promise.all(promises);
}

function init() {
    Promise.all([getRelatedArticles()]).then(() => process.exit());
}

init();