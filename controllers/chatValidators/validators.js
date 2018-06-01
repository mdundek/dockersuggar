"use strict"

const dockerController = require("../dockerController");

let PORT_MATCH = /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;

/**
 * ENTYTY VALIDATOR: validator_image
 */
exports.validate_imageName = async function(imageName) {
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
 * validate_port
 * @param {*} port 
 */
exports.validate_port = async function(port) {
    if (port.match(PORT_MATCH)) {
        return port;
    } else {
        return null;
    }
}