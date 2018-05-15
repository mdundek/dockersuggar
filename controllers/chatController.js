"use strict"

const BotDialog = require("../chatbot/BotDialog");
var { prompt } = require('inquirer');
const dockerController = require("./dockerController");
const dataController = require("./dataController");
const chalk = require("chalk");
var validator = require("validator");
let path = require("path");

exports.init = () => {
    let botDialog = new BotDialog({
        "flowBasePath": path.join(__basedir, "resources", "rasa_nlu", "flow"),
        "flowName": "dockersuggar",
        "rasaUri": "http://localhost:5000",
        "ducklingUri": "http://localhost:8000",
        "ducklingLocale": "en_GB",
        "intentProjectModel": "dockersuggar_tensorflow",
        "entityProjectModel": "dockersuggar_spacy",
        "baseNluConfidenceThreshold": 0.7
    });

    botDialog.on("text", async(text, session) => {
        console.log(chalk.bold(text));
    });

    botDialog.on("missmatch", async(nlpResult, stack, session) => {
        await dataController.logNlpMissmatch(nlpResult, stack, session);
    });

    botDialog.addActionHandler("select_image", action_selectImage);
    botDialog.addActionHandler("list_images", action_listImages);
    botDialog.addActionHandler("list_containers", action_listContainers);
    botDialog.addActionHandler("collect_image_config", action_collectImageConfig);
    botDialog.addActionHandler("list_specific_image_setting", action_listSpecificImageSetting);
    botDialog.addActionHandler("list_image_settings", action_listImageSettings);
    botDialog.addActionHandler("match_system_entities_ports", action_matchSystemEntitiesPorts);
    botDialog.addActionHandler("dump_session", action_dumpSession);

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
 * action_listContainers
 * @param {*} session 
 */
let action_listContainers = async function(session) {
    let containers = await dockerController.listContainers();
    if (containers.length == 0) {
        console.log(chalk.grey("There are no containers available."));
        return;
    }
    containers.forEach((container, i) => {
        let line = chalk.redBright(container["names"]) + " - ID " + container["container id"].substring(0, 12) + "..., created " + new Date(container["created"] * 1000);
        if (container["up"]) {
            line = chalk.green(padContainerStatus(container.state) + line);
        } else {
            line = chalk.grey(padContainerStatus(container.state) + line);
        }
        console.log(
            line
        );
        if (container.image) {
            console.log("          (IMAGE ID " + (container.image ? container.image["image id"].substring(0, 19) + "..." : "?") + " -> " + (container.image ? chalk.yellow(container.image.repository + ":" + container.image.tag) : "n/a") + ")");
        }
    });
}

/**
 * padContainerStatus
 * @param {*} label 
 */
let padContainerStatus = (label) => {
    let la = label.split("");
    let colon = false;
    for (let i = label.length; i < 10; i++) {
        if (!colon) {
            la.push(":");
            colon = true;
        } else {
            la.push(" ");
        }
    }
    return la.join("");
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
    let images = await dockerController.findImagesByName(session.entities.image_name);
    let previousSettings = await dataController.lookupImageRunConfig(images[0]);
    if (previousSettings) {
        session.attributes.found_container_settings = previousSettings;
    } else {
        delete session.attributes.found_container_settings;
    }
}

/**
 * action_listSpecificImageSetting
 * @param {*} session 
 */
let action_listSpecificImageSetting = async function(session) {
    let responses = [];
    switch (session.entities.setting_type.toLowerCase()) {
        case "port":
        case "ports":
            let ports = session.attributes.found_container_settings.settings.ports;
            for (let containerPort in ports) {
                responses.push(`The container port ${containerPort} is mapped to the host port ${ports[containerPort]}.`);
            }
            if (responses.length == 0) {
                responses.push("There are no port settings configured.");
            }
            break;
        case "volume":
        case "volumes":
            let volumes = session.attributes.found_container_settings.settings.volumes;
            for (let containerVolume in volumes) {
                responses.push(`The container volume ${containerVolume} is mapped to the host volume ${volumes[containerVolume]}.`);
            }
            if (responses.length == 0) {
                responses.push("There are no volume settings configured.");
            }
            break;
        case "environement variables":
        case "environement variable":
            let envs = session.attributes.found_container_settings.settings.env;
            for (let envName in envs) {
                responses.push(`The environement variable ${envName} has the value "${envs[envName]}".`);
            }
            if (responses.length == 0) {
                responses.push("There are no environement variables set.");
            }
            break;
        case "network":
            let networkConfigured = session.attributes.found_container_settings.settings.network;
            if (networkConfigured) {
                let networks = await dockerController.listNetworks();
                let network = networks.find(n => n.Id == session.attributes.found_container_settings.settings.networkId);

                responses.push(`The container is linked to the network "${network.Name}".`);
            } else {
                responses.push("No network was configured for this image.");
            }
            break;
        default:
            responses = await action_listImageSettings(session);
            break;
    }
    console.log(responses.join("\n"));
}

/**
 * action_dumpSession
 * @param {*} session 
 */
let action_dumpSession = async function(session) {
    console.log(JSON.stringify(session, null, 4));
}

/**
 * action_matchSystemEntitiesPorts
 * @param {*} session 
 * @param {*} botResponse 
 */
let action_matchSystemEntitiesPorts = async function(session, botResponse) {
    if (botResponse && botResponse.systemEntities && botResponse.systemEntities.length > 0) {
        let text = botResponse.text.toLowerCase();

        // Filter only number types
        let systemEntities = botResponse.systemEntities.filter(si => si.dimention == "number");

        let hostPortMatch = null;
        let containerPortMatch = null;

        // Look for obvious candidates
        systemEntities.forEach(systemEntity => {
            if (systemEntity.dimention == "number") {
                let hostCandidates = [
                    `host port ${systemEntity.value}`
                ];
                let containerCandidates = [
                    `container port ${systemEntity.value}`,
                    `image port ${systemEntity.value}`
                ];

                if (hostPortMatch == null) {
                    let hostCandidate = hostCandidates.find(candidate => text.indexOf(candidate) != -1);
                    if (hostCandidate != null) {
                        hostPortMatch = systemEntity.value;
                    }
                }
                if (containerPortMatch == null) {
                    let containerCandidate = containerCandidates.find(candidate => text.indexOf(candidate) != -1);
                    if (containerCandidate != null) {
                        containerPortMatch = systemEntity.value;
                    }
                }
            }
        });

        if (systemEntities.length == 2) {
            // If missing one out of two candidates, look for probable value
            if (hostPortMatch != null && containerPortMatch == null) {
                if (systemEntities[0].value == systemEntities[1].value) {
                    containerPortMatch = systemEntities[0].value;
                } else {
                    systemEntities.forEach(systemEntity => {
                        if (systemEntity.dimention == "number" && systemEntity.value != hostPortMatch) {
                            containerPortMatch = systemEntity.value;
                        }
                    });
                }
            } else if (hostPortMatch == null && containerPortMatch != null) {
                if (systemEntities[0].value == systemEntities[1].value) {
                    hostPortMatch = systemEntities[0].value;
                } else {
                    systemEntities.forEach(systemEntity => {
                        if (systemEntity.dimention == "number" && systemEntity.value != containerPortMatch) {
                            hostPortMatch = systemEntity.value;
                        }
                    });
                }
            }
        }

        // Set entities if matches found
        if (hostPortMatch != null) {
            session.entities.host_port = hostPortMatch;
        }
        if (containerPortMatch != null) {
            session.entities.container_port = containerPortMatch;
        }
    }
}

/**
 * action_listImageSettings
 * @param {*} session 
 */
let action_listImageSettings = async function(session) {
    let responses = [];

    if (session.attributes.found_container_settings && session.attributes.found_container_settings.settings) {
        let ports = session.attributes.found_container_settings.settings.ports;
        for (let containerPort in ports) {
            responses.push(`The container port ${containerPort} is mapped to the host port ${ports[containerPort]}.`);
        }
        let volumes = session.attributes.found_container_settings.settings.volumes;
        for (let containerVolume in volumes) {
            responses.push(`The container volume ${containerVolume} is mapped to the host volume ${volumes[containerVolume]}.`);
        }
        let envs = session.attributes.found_container_settings.settings.env;
        for (let envName in envs) {
            responses.push(`The environement variable ${envName} has the value "${envs[envName]}".`);
        }
        let networkConfigured = session.attributes.found_container_settings.settings.network;
        if (networkConfigured) {
            let networks = await dockerController.listNetworks();
            let network = networks.find(n => n.Id == session.attributes.found_container_settings.settings.networkId);

            responses.push(`The container is linked to the network "${network.Name}".`);
        }
    }

    if (responses.length == 0) {
        responses.push("Actually there is nothing special to report , no environement variables, volumes or ports have been configures.");
    }
    console.log(responses.join("\n"));
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