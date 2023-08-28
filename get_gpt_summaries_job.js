const admin = require("firebase-admin");
const fetch = require("node-fetch");
var cron = require('node-cron');
var serviceAccount = require("./serviceAccountKey.json");

const openai = require('openai'); 

const api = new openai.OpenAI({
    apiKey: "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"
});

const PORT = process.env.PORT || 8081
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function getGPTSummaries () {
    console.log("RUNNING...");

    const timestampFrame = new Date(Date.now() - 2 * 60 * 60 * 1000);     //Timestamp for the timeframe of reads

    const queryTrendingArticles = await db.collection("trending-articles").where("timestamp", ">=", timestampFrame).get();

    const promises = [];
    let txt = removeDoubleSpaces("                                                               France to ban wearing abayas in public schools                                            00:30                                                 - Source:                CNN                                                                        CNN         —             France will ban schoolchildren from wearing abayas ahead of the upcoming academic year, the government has said, the latest in a series of contentious restrictions in the country on clothing associated with Muslims.          French Education Minister Gabriel Attal said the long, robe-like garments often worn by Muslim women wouldn’t be permitted in the nation’s schools from the new term, which starts in September.          “Schools of the Republic are built on very strong values and principles, especially laïcité,” he told TV network TF1 on Sunday, using a French term referring to the separation of state institutions and religions, but which some argue has been hijacked to justify anti-Islam positions.          “For me, laïcité, when put in the framework of a school, is very clear: you enter a classroom and you must not be able to identify the religious identity of students just by looking at them,” Attal said.           But the move was criticized by a number of opposition lawmakers. Danièle Obono, a prominent opposition politician, attacked the move as a “new Islamophobic campaign” on X, formerly known as Twitter.            Jean-Luc Mélenchon, a far-left firebrand, who placed third in France’s 2022 presidential election, described his “sadness to see the return to school politically polarized by a new absurd entirely artificial religious war about a woman’s dress.”          “When will there be civil peace and true secularism that unites instead of exasperating?” Mélenchon asked.          France has pursued a series of controversial bans and restrictions on items of customarily Islamic dress in recent years, which have frequently drawn the ire of Muslim countries and international agencies.          Last year lawmakers backed a ban on wearing the hijab and other “conspicuous religious symbols” in sports competitions. The amendment was proposed by the right-wing Les Républicains party, which argued the hijab could risk the safety of athletes wearing it while playing sports.          France’s earlier ban on the niqab – full-face veils worn by some Muslim women – violated the human rights of those who wore it, the United Nations Human Rights Committee said in 2018.                     “This type of policy stands in opposition to the liberal core of the 1905 Law on Separation of Church & State – a law we’ve been distorting and weaponizing since the ’90s,” Rim-Sarah Alouane, a French legal scholar and commentator, wrote of the latest abaya ban on X.           “Such policies fuel the nation’s fractures,” she added.          Attal was asked on TF1 whether guidelines on hijabs would be enforced in schools, but refrained from commenting on those garments, and instead continued to discuss abayas.           “During my meetings with (the school heads) this summer, I sensed their need for a clear rule on the national level on the issue of abayas, so the rule is now here,” the education minister said.                   ");

    try {
        const chatCompletion = await api.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{"role": "user", "content": generatePromt(txt)}],
        });

        const response = chatCompletion.choices[0].message.content;
        console.log(response);

        // Save the summary to firebase firestore
        await db.collection('gpt-summaries').add({
            summary: response,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch(err) {
        console.log(err);
    }


    queryTrendingArticles.forEach(async (doc) => {
        const title = doc.data().title;         //Grabs reference for the document title
        i++;
        console.log(i, ": ", title);
    });

    await Promise.all(promises);
}

function generatePromt (textBody) {
    return `Create a two sentence summary for this news article: ${textBody}`
}

function removeDoubleSpaces(inputString) {
    return inputString.replace(/\s{2,}/g, ' ');
}

function init() {
    Promise.all([getGPTSummaries()]).then(() => process.exit());
}

init();