"use strict"

const BotDialog = require("e-nlu-chatbot");
var { prompt } = require('inquirer');
const dockerController = require("./dockerController");
const dataController = require("./dataController");
const chalk = require("chalk");
var validator = require("validator");
let path = require("path");

const ConfigContainerActions = require("./chatActions/configContainer");
const SlotValidators = require("./chatValidators/validators");
const Matchers = require("./conditionMatchers/matcher");
const MessageFormatter = require("./chatMessageFormatter/messageFormatter");

exports.init = async() => {
    let botDialog = new BotDialog({
        "flowBasePath": path.join(__basedir, "resources", "rasa_nlu", "flow"),
        "flowName": "dockersuggar",
        "rasaUri": "https://mdundek.space/rasanlu",
        "nluProject": "dockersuggar",
        "baseNluConfidenceThreshold": 0.79
    });

    botDialog.registerSlotFiller(fillSlot.bind(this, botDialog.id));
    botDialog.on("text", MessageFormatter.process);
    botDialog.on("missmatch", async(nlpResult, stack, session) => {
        await dataController.logNlpMissmatch(nlpResult, stack, session);
    });

    botDialog.addConditionMatchHandler("has_attributes", Matchers.matcher_has_attributes);
    botDialog.addConditionMatchHandler("has_no_attributes", Matchers.matcher_has_no_attributes);
    botDialog.addConditionMatchHandler("array_not_empty", Matchers.matcher_array_not_empty);
    botDialog.addConditionMatchHandler("array_empty", Matchers.matcher_array_empty);

    botDialog.addActionHandler("select_image", action_selectImage);
    botDialog.addActionHandler("select_network", action_selectNetwork);
    botDialog.addActionHandler("list_images", action_listImages);
    botDialog.addActionHandler("list_containers", action_listContainers);

    botDialog.addActionHandler("collect_image_config", ConfigContainerActions.action_collectImageConfig);
    botDialog.addActionHandler("list_specific_image_setting", ConfigContainerActions.action_listSpecificImageSetting);
    botDialog.addActionHandler("list_image_settings", ConfigContainerActions.action_listImageSettings);
    botDialog.addActionHandler("compute_settings_text", ConfigContainerActions.action_computeSettingsText);
    botDialog.addActionHandler("store_port_configuration", ConfigContainerActions.action_storePortConfiguration);
    botDialog.addActionHandler("store_volume_configuration", ConfigContainerActions.action_storeVolumeConfiguration);
    botDialog.addActionHandler("store_env_variable_configuration", ConfigContainerActions.action_storeEnvVariableConfiguration);
    botDialog.addActionHandler("remove_configured_volume", ConfigContainerActions.action_removeConfiguredVolume);
    botDialog.addActionHandler("remove_configured_port", ConfigContainerActions.action_removeConfiguredPort);
    botDialog.addActionHandler("remove_configured_env_variable", ConfigContainerActions.action_removeConfiguredEnvVariable);
    botDialog.addActionHandler("remove_configured_network", ConfigContainerActions.action_removeConfiguredNetwork);
    botDialog.addActionHandler("store_cmd_configuration", ConfigContainerActions.action_storeCmdConfiguration);
    botDialog.addActionHandler("undo_store_cmd_configuration", ConfigContainerActions.action_undoCommand);
    botDialog.addActionHandler("set_run_shell", ConfigContainerActions.action_setRunShell);
    botDialog.addActionHandler("set_no_shell", ConfigContainerActions.action_setNoShell);
    botDialog.addActionHandler("set_detached", ConfigContainerActions.action_setDetached);
    botDialog.addActionHandler("set_foreground", ConfigContainerActions.action_setForeground);
    botDialog.addActionHandler("set_remove_on_exit", ConfigContainerActions.action_setRemoveOnExit);
    botDialog.addActionHandler("set_dont_remove_on_exit", ConfigContainerActions.action_setDontRemoveOnExit);

    botDialog.addActionHandler("exit", action_exit);
    botDialog.addActionHandler("clean_up", action_cleanUp);
    botDialog.addActionHandler("dump_session", action_dumpSession);

    botDialog.addSlotValidator("image_name", SlotValidators.validate_imageName);
    botDialog.addSlotValidator("container_port", SlotValidators.validate_port);
    botDialog.addSlotValidator("host_port", SlotValidators.validate_port);

    await botDialog.start();

    while (true) {
        let promptResponse = await prompt({
            type: 'input',
            name: 'userInput',
            message: ':'
        });
        await botDialog.submit(promptResponse.userInput);
    }
}

/**
 * fillSlot
 * @param {*} slotQuestionText 
 */
let fillSlot = function(dialogId, slotQuestionText) {
    return new Promise((resolve, reject) => {
        MessageFormatter.process(slotQuestionText).then(() => {
            prompt({
                type: 'input',
                name: 'userInput',
                message: ':',
                validate: (data) => {
                    if (data.trim().length == 0) {
                        return "Sorry, but I need this information to proceed.";
                    } else {
                        return true;
                    }
                }
            }).then(promptResponse => {
                resolve(promptResponse.userInput);
            });
        });
    });
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
 * action_selectNetwork
 * @param {*} session 
 */
let action_selectNetwork = async function(session) {
    let networks = await dockerController.listNetworks();
    if (networks.length == 0) {
        console.log(chalk.grey("There are no networks available."));
        return;
    }
    networks.forEach((network, i) => {
        console.log(
            (i + 1) + ": " +
            chalk.redBright(network.Name)
        );
    });

    const questions = [{
        type: 'input',
        name: 'index',
        message: ':',
        validate: (index) => {
            if (validateIndexResponse(networks, index)) {
                return true;
            } else {
                return "PLease select one of the above networks please";
            }
        }
    }];

    let networkResponse = await prompt(questions);
    let nw = networks[parseInt(networkResponse.index) - 1];

    session.attributes.run_settings.value.network = true;
    session.attributes.run_settings.value.networkId = nw.Id;

    return nw.Id;
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
    session.entities = {};
    session.attributes = {};
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
 * action_dumpSession
 * @param {*} session 
 */
let action_dumpSession = async function(session) {
    console.log(JSON.stringify(session, null, 4));
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