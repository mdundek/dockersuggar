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

    botDialog.addConditionMatchHandler("has_attributes", matcher_has_attributes);
    botDialog.addConditionMatchHandler("has_no_attributes", matcher_has_no_attributes);

    botDialog.addActionHandler("select_image", action_selectImage);
    botDialog.addActionHandler("list_images", action_listImages);
    botDialog.addActionHandler("list_containers", action_listContainers);
    botDialog.addActionHandler("collect_image_config", action_collectImageConfig);
    botDialog.addActionHandler("list_specific_image_setting", action_listSpecificImageSetting);
    botDialog.addActionHandler("list_image_settings", action_listImageSettings);
    botDialog.addActionHandler("match_system_entities_ports", action_matchEntitiesPorts);
    botDialog.addActionHandler("dump_session", action_dumpSession);
    botDialog.addActionHandler("compute_settings_text", action_computeSettingsText);
    botDialog.addActionHandler("store_port_configuration", action_storePortConfiguration);
    botDialog.addActionHandler("exit", action_exit);
    botDialog.addActionHandler("clean_up", action_cleanUp);


    botDialog.addSlotValidator("image_name", validate_imageName);
    botDialog.addSlotValidator("container_port", validate_port);
    botDialog.addSlotValidator("host_port", validate_port);

    botDialog.start();
}

/**
 * CONDITION MATCHER: matcher_has_attributes
 */
let matcher_has_attributes = (session, value) => {
    return Object.keys(value).length > 0;
}

/**
 * CONDITION MATCHER: matcher_has_no_attributes
 */
let matcher_has_no_attributes = (session, value) => {
    return Object.keys(value).length == 0;
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
 * action_exit
 * @param {*} session 
 */
let action_exit = async function(session) {
    process.exit(0);
}

/**
 * action_cleanUp
 * @param {*} session 
 */
let action_cleanUp = async function(session) {
    session = {
        "entities": {},
        "attributes": {}
    };
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
 * validate_port
 * @param {*} port 
 */
let PORT_MATCH = /^([0-9]{1,4}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/;
let validate_port = async function(port) {
    if (port.match(PORT_MATCH)) {
        return port;
    } else {
        return null;
    }
}

/**
 * action_collectImageConfig
 * @param {*} session 
 */
let action_collectImageConfig = async function(session) {
    let images = await dockerController.findImagesByName(session.entities.image_name);
    let previousSettings = await dataController.lookupImageRunConfig(images[0]);
    session.attributes.run_settings = {
        value: previousSettings ? previousSettings.settings : {},
        lifespan: "default"
    };
}

/**
 * action_computeSettingsText
 * @param {*} session 
 */
let action_computeSettingsText = async function(session) {
    let responses = await getSpecificImageSetting.call(this, session, "");
    session.attributes.current_settings_text = {
        value: responses.length > 0 ? ("\n" + responses.join("\n") + "\n") : "",
        lifespan: "step"
    };
}

/**
 * action_storePortConfiguration
 * @param {*} session 
 */
let action_storePortConfiguration = async function(session) {
    if (!session.attributes.run_settings.value.ports) {
        session.attributes.run_settings.value.ports = {};
    }

    session.attributes.run_settings.value.ports[session.entities.container_port] = session.entities.host_port;

    delete session.entities.container_port;
    delete session.entities.host_port;
}

/**
 * action_listImageSettings
 * @param {*} session 
 */
let action_listImageSettings = async function(session) {
    let responses = await getSpecificImageSetting.call(this, session, "");
    if (responses.length == 0) {
        responses.push("Actually there is nothing special to report , no environement variables, volumes or ports have been configures.");
    }
    console.log(responses.join("\n"));
}

/**
 * action_listSpecificImageSetting
 * @param {*} session 
 */
let action_listSpecificImageSetting = async function(session) {
    let responses = await getSpecificImageSetting.call(this, session, session.entities.setting_type);
    delete session.entities.setting_type;
    if (responses.length == 0) {
        responses.push("Actually there is nothing special to report , no environement variables, volumes or ports have been configures.");
    }
    console.log(responses.join("\n"));
}

/**
 * getSpecificImageSetting
 * @param {*} session 
 * @param {*} settingType 
 */
let getSpecificImageSetting = async function(session, settingType) {
    let responses = [];
    switch (settingType.toLowerCase()) {
        case "port":
        case "ports":
            let ports = session.attributes.run_settings.value.ports;
            for (let containerPort in ports) {
                responses.push(`The container port ${containerPort} is mapped to the host port ${ports[containerPort]}.`);
            }
            if (responses.length == 0) {
                responses.push("There are no port settings configured.");
            }
            break;
        case "volume":
        case "volumes":
            let volumes = session.attributes.run_settings.value.volumes;
            for (let containerVolume in volumes) {
                responses.push(`The container volume ${containerVolume} is mapped to the host volume ${volumes[containerVolume]}.`);
            }
            if (responses.length == 0) {
                responses.push("There are no volume settings configured.");
            }
            break;
        case "environement variables":
        case "environement variable":
            let envs = session.attributes.run_settings.value.env;
            for (let envName in envs) {
                responses.push(`The environement variable ${envName} has the value "${envs[envName]}".`);
            }
            if (responses.length == 0) {
                responses.push("There are no environement variables set.");
            }
            break;
        case "network":
            let networkConfigured = session.attributes.run_settings.value.network;
            if (networkConfigured) {
                let networks = await dockerController.listNetworks();
                let network = networks.find(n => n.Id == session.attributes.run_settings.value.networkId);

                responses.push(`The container is linked to the network "${network.Name}".`);
            } else {
                responses.push("No network was configured for this image.");
            }
            break;
        default:
            let portResponse = await getSpecificImageSetting.call(this, session, "port");
            let volumeResponse = await getSpecificImageSetting.call(this, session, "volume");
            let envResponse = await getSpecificImageSetting.call(this, session, "environement variables");
            let networksResponse = await getSpecificImageSetting.call(this, session, "network");

            responses = responses.concat(portResponse, volumeResponse, envResponse, networksResponse);
            break;
    }
    return responses;
}

/**
 * action_dumpSession
 * @param {*} session 
 */
let action_dumpSession = async function(session) {
    console.log(JSON.stringify(session, null, 4));
}

/**
 * action_matchEntitiesPorts
 * @param {*} session 
 * @param {*} botResponse 
 */
let action_matchEntitiesPorts = async function(session, botResponse) {
    // if (botResponse && botResponse.systemEntities && botResponse.systemEntities.length > 0) {
    //     let text = botResponse.text.toLowerCase();

    //     // Filter only number types
    //     let systemEntities = botResponse.systemEntities.filter(si => si.dimention == "number");

    //     let hostPortMatch = null;
    //     let containerPortMatch = null;

    //     // Look for obvious candidates
    //     systemEntities.forEach(systemEntity => {
    //         if (systemEntity.dimention == "number") {
    //             let hostCandidates = [
    //                 `host port ${systemEntity.value}`
    //             ];
    //             let containerCandidates = [
    //                 `container port ${systemEntity.value}`,
    //                 `image port ${systemEntity.value}`
    //             ];

    //             if (hostPortMatch == null) {
    //                 let hostCandidate = hostCandidates.find(candidate => text.indexOf(candidate) != -1);
    //                 if (hostCandidate != null) {
    //                     hostPortMatch = systemEntity.value;
    //                 }
    //             }
    //             if (containerPortMatch == null) {
    //                 let containerCandidate = containerCandidates.find(candidate => text.indexOf(candidate) != -1);
    //                 if (containerCandidate != null) {
    //                     containerPortMatch = systemEntity.value;
    //                 }
    //             }
    //         }
    //     });

    //     if (systemEntities.length == 2) {
    //         // If missing one out of two candidates, look for probable value
    //         if (hostPortMatch != null && containerPortMatch == null) {
    //             if (systemEntities[0].value == systemEntities[1].value) {
    //                 containerPortMatch = systemEntities[0].value;
    //             } else {
    //                 systemEntities.forEach(systemEntity => {
    //                     if (systemEntity.dimention == "number" && systemEntity.value != hostPortMatch) {
    //                         containerPortMatch = systemEntity.value;
    //                     }
    //                 });
    //             }
    //         } else if (hostPortMatch == null && containerPortMatch != null) {
    //             if (systemEntities[0].value == systemEntities[1].value) {
    //                 hostPortMatch = systemEntities[0].value;
    //             } else {
    //                 systemEntities.forEach(systemEntity => {
    //                     if (systemEntity.dimention == "number" && systemEntity.value != containerPortMatch) {
    //                         hostPortMatch = systemEntity.value;
    //                     }
    //                 });
    //             }
    //         }
    //     }

    //     // Set entities if matches found
    //     if (hostPortMatch != null) {
    //         session.entities.host_port = hostPortMatch;
    //     }
    //     if (containerPortMatch != null) {
    //         session.entities.container_port = containerPortMatch;
    //     }
    // }
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