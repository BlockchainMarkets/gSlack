function runTest(test, data) {
    try {
        $ = data;
        return eval(`'use strict';(${test});`);
    }
    catch (err) {
        console.log(`Rule test error in '${test}': ${err}`);
        return false;
    }
}

function evalMessage(message, data) {
    try {
        $ = data;
        return eval(`'use strict';\`${message}\`;`);
    }
    catch (err) {
        console.log(`Rule message error in '${message}': ${err}`);
        return "";
    }
}

exports.pubsubLogSink = function (event, context) {
    const base64 = require('base-64');
    let data = JSON.parse(base64.decode(event.data));

    Promise.all([
        getConfig(),
        getTests()
    ])
        .then(([config, tests]) => {
            return Promise.all(tests.map(test => {
                let clonedData = JSON.parse(JSON.stringify(data));
                if (runTest(test.test, clonedData)) {
                    let message = evalMessage(test.message, clonedData);
                    console.log('Sending to slack: ' + message);
                    return sendSlack(test.slackChannel, message, 'xoxb-140199171318-363521511682-gRnBllDbJZFRAg66rm0Ygtt1');
                }
                else {
                    return Promise.resolve("no match for message insert id: " + clonedData.insertId + ", test: " + test.test);
                }
            }));
        })
        .then((ret) => {
            console.log(ret);
        })
        .catch(err => {
            console.log(err);
        });
};

function getConfig() {
    const Datastore = require('@google-cloud/datastore');
    const ds = Datastore();
    const query = ds.createQuery(['Config']);
    return runDSQuery(ds, query).then(configsArray => {
        return configsArray.reduce((configs, config) => {
            console.log(config.name + ": " + config.value);
            configs[config.name] = config.value;
            return configs;
        }, {});
    });
}

function getTests() {
    const Datastore = require('@google-cloud/datastore');
    const ds = Datastore();
    const query = ds.createQuery(['Test']);
    return runDSQuery(ds, query);
}

function runDSQuery(ds, query) {
    const Datastore = require('@google-cloud/datastore');
    return new Promise((resolve, reject) => {
        ds.runQuery(query, (err, entities, nextQuery) => {
            if (err) {
                reject(err);
            }
            const hasMore = !!nextQuery && nextQuery.moreResults !== Datastore.NO_MORE_RESULTS ? nextQuery.endCursor : false;
            if (hasMore) {
                runDSQuery(ds, nextQuery).then(moreEntities => {
                    resolve(entities.concat(moreEntities));
                });
            }
            else {
                resolve(entities);
            }
        });
    });
}

function sendSlack(channel, message, apiToken) {
    const Slack = require('slack-node');

    return new Promise((resolve, reject) => {
        const slack = new Slack(apiToken);
        slack.api('chat.postMessage', {
            text: message,
            channel: channel,
            as_user: true
        }, function (err, response) {
            if (!!err) {
                reject(err);
            }
            else {
                resolve(response);
            }
        });
    });
}

