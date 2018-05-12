"use strict"

const BotDialog = require("../chatbot/BotDialog");
const DialogJSON = new require("../chatbot/dialog.json");
var { prompt } = require('inquirer');
const dockerController = require("./dockerController");
const chalk = require("chalk");
var validator = require("validator");

exports.init = () => {
    let botDialog = new BotDialog(DialogJSON);

    botDialog.addActionHandler("select_image", action_selectImage);
    botDialog.addActionHandler("list_images", action_listImages);
    botDialog.addActionHandler("collect_image_config", action_collectImageConfig);


    botDialog.addSlotValidator("image_name", validate_imageName);

    botDialog.start();
}

/**
 * ACTION: action_selectImage
 */
let action_selectImage = async function(session) {
    let images = await dockerController.listImages();
    if (images.length == 0) {
        console.log(chalk.grey("There are no images available."));
        return;
    }
    images.forEach((image, i) => {
        console.log(
            (i + 1) + ": " +
            chalk.redBright(image.repository) +
            chalk.yellow(" (" + image.tag + ")")
        );
    });

    const questions = [{
        type: 'input',
        name: 'index',
        message: ':',
        validate: (index) => {
            if (validateIndexResponse(images, index)) {
                return true;
            } else {
                return "PLease select one of the above images please";
            }
        }
    }];

    let imgResponse = await prompt(questions);
    let img = images[parseInt(imgResponse.index) - 1];

    return img.repository + ":" + img.tag;
}

/**
 * action_listImages
 * @param {*} session 
 */
let action_listImages = async function(session) {
    let images = await dockerController.listImages();
    if (images.length == 0) {
        console.log(chalk.grey("There are no images available."));
        return;
    }
    images.forEach((image, i) => {
        console.log(
            chalk.redBright(image.repository) +
            chalk.yellow(" (" + image.tag + ")") +
            chalk.grey(" - ID " + image["image id"].substring(0, 19) + "..." + ", SIZE " + image["size"])
        );
    });
}

/**
 * ENTYTY VALIDATOR: validator_image
 */
let validate_imageName = async function(imageName) {
    let imageDetails = imageName.split(":");
    if (imageDetails.length == 2 && imageDetails[1] == "latest") {
        imageDetails.splice(1, 1);
    }
    let images = await dockerController.listImages();

    let imageMatches = images.filter(i => {
        if (i.repository.toLowerCase() == imageDetails[0].toLowerCase()) {
            if (imageDetails.length == 1) {
                return true;
            } else {
                if (i.tag == imageDetails[1]) {
                    return true;
                } else {
                    return false;
                }
            }
        }
    });

    let returnMatch = null;
    if (imageMatches.length == 1) {
        returnMatch = imageMatches[0].repository + ":" + imageMatches[0].tag;
    } else if (imageMatches.length > 1) {
        let latest = imageMatches.find(i => i.tag == "latest");
        if (latest) {
            returnMatch = latest.repository + ":" + latest.tag;
        } else {
            imageMatches.sort((a, b) => {
                if (a.created < b.created)
                    return -1;
                if (a.created > b.created)
                    return 1;
                return 0;
            });
            returnMatch = imageMatches[imageMatches.length - 1].repository + ":" + imageMatches[imageMatches.length - 1].tag;
        }
    }

    return returnMatch;
}

/**
 * action_collectImageConfig
 * @param {*} session 
 */
let action_collectImageConfig = async function(session) {
    session.attributes.found_container_settings = {};
}

/**
 * validateIndexResponse
 * @param {*} collection 
 * @param {*} sIndex 
 */
let validateIndexResponse = (collection, sIndex) => {
    if (validator.isInt(sIndex)) {
        let _i = parseInt(sIndex);
        return (_i >= 1 && _i <= collection.length);
    } else {
        return false;
    }
};