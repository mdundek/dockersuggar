"use strict"

const chalk = require("chalk");

const FONT_PATTERN = /<font style=(.*?)>([\s\S]*)<\/font>/;

/**
 * process
 * @param {*} text 
 * @param {*} session 
 */
exports.process = async(text, session) => {
    let fontMatcher;
    let resolvedText = "";
    while (fontMatcher = FONT_PATTERN.exec(text)) {
        resolvedText += chalk.bold(text.substring(0, fontMatcher.index));
        if (fontMatcher[1] == "normal") {
            resolvedText += fontMatcher[2];
        }
        text = text.substring(fontMatcher.index + fontMatcher[0].length);
    }
    resolvedText += chalk.bold(text);
    console.log(resolvedText);
}