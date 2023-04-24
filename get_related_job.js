const admin = require("firebase-admin");
const fetch = require("node-fetch");
var cron = require('node-cron');
var serviceAccount = require("./serviceAccountKey.json");
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
	// Do New Logic Here
};

function init() {
    Promise.all([start()]).then(() => process.exit());
}

init();