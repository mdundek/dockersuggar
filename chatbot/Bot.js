"use strict"

const request = require('request-promise');

/**
 * Bot
 * @param {*} config 
 */
let Bot = function(config) {
    let defaults = {
        "rasa_uri": "http://localhost:5000",
        "threshold": 0.6
    }
    if (config) {
        Object.assign(defaults, config);
    }
    this.config = defaults;
    this.registeredIntents = [];
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
                    uri: `${this.config.rasa_uri}/parse?q=${encodeURI(message.text)}&project=dockersuggar`,
                    json: true // Automatically stringifies the body to JSON
                });

                if (response.intent.confidence > this.config.threshold) {
                    message.intent = response.intent;
                }
                message.entities = response.entities;

                resolve(message);
            } catch (e) {
                reject(e);
            }
        })();
    });
}

module.exports = Bot;