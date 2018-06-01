"use strict"

const dockerController = require("../dockerController");
const dataController = require("../dataController");
const ChatMessageFormatter = require("../chatMessageFormatter/messageFormatter");
const { prompt } = require('inquirer');

/**
 * action_collectImageConfig
 * @param {*} session 
 */
exports.action_collectImageConfig = async function(session) {
    let images = await dockerController.findImagesByName(session.entities.image_name);
    let previousSettings = await dataController.lookupImageRunConfig(images[0]);
    session.attributes.run_settings = {
        value: previousSettings ? previousSettings.settings : {
            cmd: null,
            shell: false,
            bgMode: false,
            remove: false,
            network: false,
            networkId: null,
            volumes: {},
            ports: {}
        },
        lifespan: "default"
    };
}

/**
 * action_computeSettingsText
 * @param {*} session 
 */
exports.action_computeSettingsText = async function(session) {
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
exports.action_storePortConfiguration = async function(session) {
    if (!session.attributes.run_settings.value.ports) {
        session.attributes.run_settings.value.ports = {};
    }

    session.attributes.run_settings.value.ports[session.entities.container_port] = session.entities.host_port;

    delete session.entities.container_port;
    delete session.entities.host_port;
}

/**
 * action_storeVolumeConfiguration
 * @param {*} session 
 */
exports.action_storeVolumeConfiguration = async function(session) {
    if (!session.attributes.run_settings.value.volumes) {
        session.attributes.run_settings.value.volumes = {};
    }

    session.attributes.run_settings.value.volumes[session.entities.container_volume] = session.entities.host_volume;

    delete session.entities.container_volume;
    delete session.entities.host_volume;
}

/**
 * action_removeConfiguredVolume
 * @param {*} session 
 */
exports.action_removeConfiguredVolume = async function(session) {
    let questions = [{
        type: 'list',
        name: 'volumeChoice',
        message: 'What volume do you want to unmap:',
        choices: []
    }];

    for (let containerVolume in session.attributes.run_settings.value.volumes) {
        questions[0].choices.push(containerVolume);
    }

    let volumeToRemove = await prompt(questions);
    delete session.attributes.run_settings.value.volumes[volumeToRemove.volumeChoice];
}

/**
 * action_removeConfiguredPort
 * @param {*} session 
 */
exports.action_removeConfiguredPort = async function(session) {
    let questions = [{
        type: 'list',
        name: 'portChoice',
        message: 'What container port mapping do you want to undo:',
        choices: []
    }];

    for (let cPort in session.attributes.run_settings.value.ports) {
        questions[0].choices.push(cPort);
    }

    let portToRemove = await prompt(questions);

    delete session.attributes.run_settings.value.ports[portToRemove.portChoice];
}

/**
 * action_removeConfiguredEnvVariable
 * @param {*} session 
 */
exports.action_removeConfiguredEnvVariable = async function(session) {
    let questions = [{
        type: 'list',
        name: 'envChoice',
        message: 'What environement variable do you want to remove:',
        choices: []
    }];

    for (let envName in session.attributes.run_settings.value.env) {
        questions[0].choices.push(envName);
    }

    let envToRemove = await prompt(questions);
    delete session.attributes.run_settings.value.env[envToRemove.envChoice];
}

/**
 * action_removeConfiguredNetwork
 * @param {*} session 
 */
exports.action_removeConfiguredNetwork = async function(session) {
    session.attributes.run_settings.value.network = false;
    delete session.attributes.run_settings.value.networkId;
}














/**
 * action_storeEnvVariableConfiguration
 * @param {*} session 
 */
exports.action_storeEnvVariableConfiguration = async function(session) {
    if (!session.attributes.run_settings.value.env) {
        session.attributes.run_settings.value.env = {};
    }

    session.attributes.run_settings.value.env[session.entities.env_name] = session.entities.env_value;

    delete session.entities.env_name;
    delete session.entities.env_value;
}

/**
 * action_storeCmdConfiguration
 * @param {*} session 
 */
exports.action_storeCmdConfiguration = async function(session) {
    session.attributes.run_settings.value.cmd = [session.entities.set_command];
    delete session.entities.set_command;
}

/**
 * action_store_command
 * @param {*} session 
 */
exports.action_undoCommand = async function(session) {
    session.attributes.run_settings.value.cmd = null;
}

/**
 * action_setRunShell
 * @param {*} session 
 */
exports.action_setRunShell = async function(session) {
    session.attributes.run_settings.value.shell = true;
}

/**
 * action_setNoShell
 * @param {*} session 
 */
exports.action_setNoShell = async function(session) {
    session.attributes.run_settings.value.shell = false;
}

/**
 * action_setDetached
 * @param {*} session 
 */
exports.action_setDetached = async function(session) {
    session.attributes.run_settings.value.bgMode = true;
}

/**
 * action_setForeground
 * @param {*} session 
 */
exports.action_setForeground = async function(session) {
    session.attributes.run_settings.value.bgMode = false;
}

/**
 * action_setRemoveOnExit
 * @param {*} session 
 */
exports.action_setRemoveOnExit = async function(session) {
    session.attributes.run_settings.value.remove = true;
}

/**
 * action_setDontRemoveOnExit
 * @param {*} session 
 */
exports.action_setDontRemoveOnExit = async function(session) {
    session.attributes.run_settings.value.remove = false;
}

/**
 * action_listImageSettings
 * @param {*} session 
 */
exports.action_listImageSettings = async function(session) {
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
exports.action_listSpecificImageSetting = async function(session) {
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
        case "command":
        case "commands":
        case "cmd":
            if (session.attributes.run_settings.value.cmd) {
                session.attributes.run_settings.value.cmd.forEach(c => {
                    responses.push("The following commands is set: " + c);
                });
            } else {
                responses.push("No custom command has been set.");
            }
            break;
        case "detached":
            if (session.attributes.run_settings.value.bgMode) {
                responses.push("The container will start in detached mode.");
            } else {
                responses.push("The container will run in the foreground.");
            }
            break;
        case "shell":
            if (session.attributes.run_settings.value.shell) {
                responses.push("The container will start a shell session.");
            } else {
                responses.push("The container will not start a shell session.");
            }
            break;
        case "remove":
            if (session.attributes.run_settings.value.remove) {
                responses.push("The container will be removed on exit.");
            } else {
                responses.push("The container will not be removed on exit.");
            }
            break;
        default:
            let portResponse = await getSpecificImageSetting.call(this, session, "port");
            let volumeResponse = await getSpecificImageSetting.call(this, session, "volume");
            let envResponse = await getSpecificImageSetting.call(this, session, "environement variables");
            let networksResponse = await getSpecificImageSetting.call(this, session, "network");
            let cmdResponse = await getSpecificImageSetting.call(this, session, "cmd");
            let detachedResponse = await getSpecificImageSetting.call(this, session, "detached");
            let shellResponse = await getSpecificImageSetting.call(this, session, "shell");
            let removeResponse = await getSpecificImageSetting.call(this, session, "remove");

            responses = responses.concat(
                portResponse,
                volumeResponse,
                envResponse,
                networksResponse,
                cmdResponse,
                detachedResponse,
                shellResponse,
                removeResponse
            );
            break;
    }
    return responses;
}