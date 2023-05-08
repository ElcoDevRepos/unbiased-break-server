/* eslint-disable */
const admin = require("firebase-admin");
const fetch = require("node-fetch");
var cron = require('node-cron');
var serviceAccount = require("./serviceAccountKey.json");
const PORT = process.env.PORT || 8081
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

let leftSources = [];
let middleSources = [];
let rightSources = [];
let sources = [];

let baseURL = "https://url-content-extractor.p.rapidapi.com/";
const options = {
    method: "GET",
    headers: {
        "X-RapidAPI-Key": "3b3d59a4b1msh9fe345204a200d6p1bf9cdjsnbc7461a03162",
        "X-RapidAPI-Host": "url-content-extractor.p.rapidapi.com"
    }
};

function getProperCollection(a) {
    let rightContains = rightSources.some(e => {
        if (a.link.includes(e)) return true;
        return false;
    })

    let middleContains = middleSources.some(e => {
        if (a.link.includes(e)) return true;
        return false;
    })

    let leftContains = leftSources.some(e => {
        if (a.link.includes(e)) return true;
        return false;
    })

    if (rightContains) return "right-articles";
    else if (middleContains) return "middle-articles";
    else if (leftContains) return "left-articles";
    else return "No Source Found";
}

async function getContent(json) {
    try {
        baseURL = "https://url-content-extractor.herokuapp.com/";
        let response = await fetch(baseURL + "content?url=" + json.link, options);
        let respJson = await response.json();
        return respJson;
    } catch (error) {
        return { status: 500 };
    }
}

async function doFeed(searchTopics, flag) {
    return new Promise(async (resolve, reject) => {
        let searches = [];

        sources.forEach((s) => {
            let str = s.split('.')[0];
            searches.push({ topic: str + " " + searchTopics.topic, id: searchTopics.id });
        });

        let searchTopicsResp = [];
        for (let i = 0; i < searches.length; i++) {
            try {
                searchTopicsResp.push({ article: await doSearch(searches[i]), topic: searches[i].id });
            } catch (error) {
                console.log(error);
            }
        }
        let promises = [];
        let final = [];
        for (let i = 0; i < searchTopicsResp.length; i++) {
            let s = searchTopicsResp[i];
            let aList = s.article;
            if (aList.length > 0) {
                for (let j = 0; j < aList.length; j++) {
                    let a = aList[j];
                    try {
                        let art = await getContent(a);
                        if (art.status === 200) {
                            final.push({ ...art.article, date: new Date(a.date), rating: 0, hearts: 0, topic: s.topic, deleted: false, timestamp: admin.firestore.Timestamp.now(), related_articles: [] });
                        }
                    } catch (error) {
                        console.log(error);
                    }
                }

            }
        }

        for (let i = 0; i < final.length; i++) {
            let a = final[i];
            let collectionName = getProperCollection(a);

            if (collectionName === 'No Source Found') {
                //console.log(collectionName + ": " + a.link);
            } else {
                let collection = db.collection(collectionName);
                let linkQuery = collection.where("link", "==", a.link);
                let titleQuery = collection.where("title", "==", a.title);
                let combinedQuery = linkQuery || titleQuery;
                let docs = await combinedQuery.get();

                if (docs.empty) {
                    await db.collection(collectionName).add(a);
                } else {
                    console.log("ALREADY ADDED");
                }
            }
        }
        resolve();
    })

}

async function doSearch(query) {
    try {
        let response = await fetch(baseURL + "search?query=" + query.topic, options);
        let json = await response.json();
        return json;
    } catch (error) {
        console.log(error);
        return { status: 400 }
    }
}

async function getSources() {
    leftSources = [];
    middleSources = [];
    rightSources = [];
    let leftDocs = await db.collection("left-sources").get();
    let midDocs = await db.collection("middle-sources").get();
    let rightDocs = await db.collection("right-sources").get();

    leftDocs.forEach((d) => leftSources.push(d.data().url));
    midDocs.forEach((d) => middleSources.push(d.data().url));
    rightDocs.forEach((d) => rightSources.push(d.data().url));
    sources.push(...leftSources, ...middleSources, ...rightSources);
}

async function doTrending(json) {
    try {
        let articles = json.articles;
        let final = [];
        for (let i = 0; i < articles.length; i++) {
            try {
                let a = articles[i];

                let art = await getContent(a);
                if (art.status === 200) {
                    final.push({ ...art.article, date: new Date(a.date), rating: 0, hearts: 0, deleted: false, timestamp: admin.firestore.Timestamp.now(), related_articles: [] });
                }
            } catch (error) {
                console.log(error)
            }

        }
        for (let i = 0; i < final.length; i++) {
            try {
                let a = final[i];
                let collection = db.collection("trending-articles");
                let linkQuery = collection.where("link", "==", a.link);
                let titleQuery = collection.where("title", "==", a.title);
                let combinedQuery = linkQuery || titleQuery;
                let docs = await combinedQuery.get();
                if (docs.empty) {
                    db.collection("trending-articles").add(a);
                }
            } catch (error) {
                console.log(error)
            }

        }
    } catch (error) {
        console.log(error)
    }

}

async function start() {
    console.log("RUNNING");
    await getSources();
    let response = await fetch(baseURL + "trending", options);
    let json = await response.json();
    await doTrending(json);
    let topicsSnap = await db.collection("topics").get();

    let topics = [];
    topicsSnap.forEach((top) => {
        topics.push({ topic: top.data().name, id: top.data().id });
    });
    for (let i = 0; i < topics.length; i++) {
        await doFeed(topics[i])
    }



    return
}

function init() {
    Promise.all([start()]).then(() => process.exit());
}

init();
