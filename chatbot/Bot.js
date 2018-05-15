"use strict"

const request = require('request-promise');

/**
 * Bot
 * @param {*} config 
 */
let Bot = function(config) {
    let defaults = {
        "rasaUri": "http://localhost:5000",
        "ducklingUri": "http://localhost:8000",
        "ducklingLocale": "en_GB",
        "threshold": 0.8,
        "intentProjectModel": "default",
        "entityProjectModel": "default"
    }
    if (config) {
        Object.assign(defaults, config);
    }
    this.config = defaults;
}

/**
 * say
 * @param {*} message 
 */
Bot.prototype.say = function(message) {
    return new Promise((resolve, reject) => {
        (async() => {
            try {
                if (!message.text || message.is_echo) {
                    return;
                }
                let response = await request({
                    method: 'GET',
                    uri: `${this.config.rasaUri}/parse?q=${encodeURI(message.text)}&project=${this.config.intentProjectModel}`,
                    json: true // Automatically stringifies the body to JSON
                });

                if (response.intent.confidence > (message.threshold != null ? message.threshold : this.config.threshold)) {
                    message.intent = response.intent;
                }

                if (this.config.intentProjectModel != this.config.entityProjectModel) {
                    response = await request({
                        method: 'GET',
                        uri: `${this.config.rasaUri}/parse?q=${encodeURI(message.text)}&project=${this.config.entityProjectModel}`,
                        json: true // Automatically stringifies the body to JSON
                    });

                    message.entities = response.entities;
                } else {
                    message.entities = response.entities;
                }

                if (this.config.ducklingUri != null) {
                    response = await request({
                        method: 'POST',
                        uri: `${this.config.ducklingUri}/parse`,
                        form: {
                            "locale": this.config.ducklingLocale,
                            "text": message.text
                        },
                        json: true // Automatically stringifies the body to JSON
                    });

                    if (response.length > 0) {
                        message.systemEntities = [];
                        response.forEach(match => {
                            match.value.dimention = match.dim;
                            message.systemEntities.push(match.value);
                        });
                    }
                }
                resolve(message);
            } catch (e) {
                reject(e);
            }
        })();
    });
}

module.exports = Bot;