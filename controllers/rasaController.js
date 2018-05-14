"use strict"

let dockerController = require("../controllers/dockerController");
let dataController = require("../controllers/dataController");
var { prompt } = require('inquirer');
var path = require('path');
var fs = require('fs');
var chalk = require('chalk');
var request = require('request-promise');
var self = require('./rasaController');
const ora = require('ora');
const chatito = require("chatito");

const spinner = ora('');
spinner.color = 'yellow';

exports.init = async() => {
    spinner.start();
    spinner.text = 'Initializing ChatBot...';

    try {
        // Get RASA status
        let status = await self.getStatus();

        // RASA not installed
        if (!status.online && !status.rasaContainer) {
            throw new Error("ChatBot container not installed. Please run the command <dockersuggar installConversationalAgent> and try again.");
        }

        // RASA not installed
        if (!status.ducklingContainer) {
            throw new Error("ChatBot dependency container not installed. Please run the command <dockersuggar installConversationalAgent> and try again.");
        }

        // RASA Duckling container is stopped or paused
        if (status.ducklingContainer.state == "stopped" || status.ducklingContainer.state == "exited") {
            spinner.text = 'Starting RASA Duckling container...';
            await dockerController.startContainer(status.ducklingContainer);
        } else if (status.ducklingContainer.state == "paused") {
            spinner.text = 'Unpausing RASA Duckling container...';
            await dockerController.unpauseContainer(status.ducklingContainer);
        }

        // RASA container is stopped or paused
        if (!status.online && status.rasaContainer) {
            // Start container if stopped
            if (status.rasaContainer.state == "stopped" || status.rasaContainer.state == "exited") {
                spinner.text = 'Starting RASA container...';
                await dockerController.startContainer(status.rasaContainer);
            } else if (status.rasaContainer.state == "paused") {
                spinner.text = 'Unpausing RASA container...';
                await dockerController.unpauseContainer(status.rasaContainer);
            }
            // RASA container error, need to reinstall
            else {
                throw new Error("ChatBot container seems to be installed, but unavailable. Try running the command <dockersuggar installConversationalAgent> to fix the problem.");
            }
            // Get RASA status again to see if everything is ok now
            status = await self.getStatus(true);
        }

        // If RASA is available, but model is not found
        if (status.online && status.models.length != 2) {
            // Train model
            let respondedInTime = await self.trainModel();
            if (!respondedInTime) {
                // Timed out, try again later
                throw new Error("The dockersuggar model is not available yet, this migt take a couple of minutes. Please try again later.");
            }
            // Get status again, should all be good now
            status = await self.getStatus();
        }

        if (!status.online || !status.rasaContainer || status.models.length != 2) {
            throw new Error("ChatBot container seems to be installed, but unavailable. Try running the command <dockersuggar installConversationalAgent> to fix the problem.");
        }
        if (!status.inMemory) {
            await self.loadModel();
        }
        spinner.stop();
    } catch (e) {
        spinner.stop();
        throw e;
    }
}

/**
 * installAndSetupRasa
 */
exports.installAndSetupRasa = async() => {
    spinner.start();
    spinner.text = 'Installing ChatBot...';

    try {
        let images = await dockerController.listImages();
        let rasaImage = await self.pullRasaImage(images);
        let ducklingImage = await self.pullDucklingImage(images);
        spinner.start();
        if (rasaImage && ducklingImage) {
            let containers = await dockerController.listContainers();
            let rasaContainer = containers.find(r => r.names == "/dockersuggar_rasa_nlu");
            if (rasaContainer) {
                spinner.text = 'Removing previous rasa container instance...';
                await dockerController.deleteContainer(rasaContainer);
            }
            await self.createAndStartRasaContainer(rasaImage);

            let ducklingContainer = containers.find(r => r.names == "/dockersuggar_rasa_duckling");
            if (ducklingContainer) {
                spinner.text = 'Removing previous duckling container instance...';
                await dockerController.deleteContainer(ducklingContainer);
            }
            await self.createAndStartDucklingContainer(ducklingImage);
            spinner.stop();
        } else {
            throw new Error("Rasa installation aboarded");
        }
    } catch (e) {
        spinner.stop();
        throw e;
    }
}

/**
 * trainModel
 * @param {*} delay 
 */
exports.loadModel = () => {
    return new Promise((resolve, reject) => {
        spinner.text = 'Loading chatbot models...';

        (async() => {
            let start = new Date().getTime();
            let timeout = 120 * 1000;
            try {
                spinner.text = 'Loading tensorflow models...';
                let response = await request({
                    method: 'GET',
                    uri: 'http://localhost:5000/parse?q=Hello&project=dockersuggar_tensorflow',
                    timeout: timeout,
                    json: true // Automatically stringifies the body to JSON
                });
                spinner.text = 'Loading spacy models, this might take up to a minute...';
                response = await request({
                    method: 'GET',
                    uri: 'http://localhost:5000/parse?q=Hello&project=dockersuggar_spacy',
                    timeout: timeout,
                    json: true // Automatically stringifies the body to JSON
                });
                resolve();
            } catch (e) {
                // Detect timeout error, does not cause model from being trained
                if ((new Date().getTime() - start) >= timeout) {
                    resolve();
                } else {
                    reject(e);
                }
            }
        })();
    });
}

/**
 * trainModel
 * @param {*} delay 
 */
exports.trainModel = (delay) => {
    return new Promise((resolve, reject) => {
        spinner.text = 'Building training set...';
        spinner.start();
        setTimeout(() => {
            (async() => {
                try {
                    let dslDefinitionString = fs.readFileSync(path.join(__basedir, "resources", "rasa_nlu", "training", "dockersuggar.chatito")).toString().trim();
                    const dataset = chatito.datasetFromString(dslDefinitionString);
                    let start = new Date().getTime();
                    let timeout = 120 * 1000;

                    let rasaConfigTensorflow = fs.readFileSync(path.join(__basedir, "resources", "rasa_nlu", "training", "config_tensorflow.yml")).toString();
                    rasaConfigTensorflow = rasaConfigTensorflow.replace("_data_", JSON.stringify(dataset, null, 4));

                    let rasaConfigSklearn = fs.readFileSync(path.join(__basedir, "resources", "rasa_nlu", "training", "config_spacy.yml")).toString();
                    rasaConfigSklearn = rasaConfigSklearn.replace("_data_", JSON.stringify(dataset, null, 4));

                    spinner.text = 'Training tensorflow dockersuggar model, this might take some minutes...';
                    let response = await request({
                        method: 'POST',
                        uri: 'http://localhost:5000/train?project=dockersuggar_tensorflow',
                        body: rasaConfigTensorflow,
                        headers: {
                            'content-type': 'application/x-yml'
                        },
                        timeout: timeout
                    });
                    spinner.text = 'Training spacy dockersuggar model, this might take some minutes...';
                    response = await request({
                        method: 'POST',
                        uri: 'http://localhost:5000/train?project=dockersuggar_spacy',
                        body: rasaConfigSklearn,
                        headers: {
                            'content-type': 'application/x-yml'
                        },
                        timeout: timeout
                    });
                    spinner.stop();
                    resolve(true);
                } catch (e) {
                    spinner.stop();
                    // Detect timeout error, does not cause model from being trained
                    if ((new Date().getTime() - start) >= timeout) {
                        resolve(false);
                    } else {
                        reject(e);
                    }
                }
            })();
        }, delay ? 4000 : 0);
    });
}

/**
 * getModelStatus
 */
exports.getStatus = (delay) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            (async() => {
                try {
                    let containers = await dockerController.listContainers();
                    let rasaContainer = containers.find(r => r.names == "/dockersuggar_rasa_nlu");
                    let ducklingContainer = containers.find(r => r.names == "/dockersuggar_rasa_duckling");

                    if (!rasaContainer || !ducklingContainer) {
                        resolve({
                            "online": false,
                            "ready": false,
                            "models": [],
                            "rasaContainer": null,
                            "ducklingContainer": ducklingContainer,
                            "inMemory": false
                        });
                        return;
                    }

                    let response = await request({
                        method: 'GET',
                        uri: 'http://localhost:5000/status',
                        json: true // Automatically stringifies the body to JSON
                    });

                    let readyTensorflow = response.available_projects && response.available_projects.dockersuggar_tensorflow && response.available_projects.dockersuggar_tensorflow.status == "ready";
                    let readySklearn = response.available_projects && response.available_projects.dockersuggar_spacy && response.available_projects.dockersuggar_spacy.status == "ready";

                    let loadedTensorflow = readyTensorflow ? (response.available_projects.dockersuggar_tensorflow.loaded_models.find(m => m != "fallback") ? true : false) : false;
                    let loadedSklearn = readyTensorflow ? (response.available_projects.dockersuggar_tensorflow.loaded_models.find(m => m != "fallback") ? true : false) : false;

                    if (readyTensorflow || readySklearn) {
                        let models = [];
                        if (readyTensorflow) {
                            models.push("dockersuggar_tensorflow");
                        }
                        if (readySklearn) {
                            models.push("dockersuggar_spacy");
                        }
                        resolve({
                            "online": true,
                            "ready": readyTensorflow && readySklearn,
                            "rasaContainer": rasaContainer,
                            "ducklingContainer": ducklingContainer,
                            "models": models,
                            "inMemory": loadedTensorflow && loadedSklearn
                        });
                    } else {
                        resolve({
                            "online": true,
                            "ready": readyTensorflow && readySklearn,
                            "rasaContainer": rasaContainer,
                            "ducklingContainer": ducklingContainer,
                            "models": [],
                            "inMemory": loadedTensorflow && loadedSklearn
                        });
                    }
                } catch (e) {
                    resolve({
                        "online": false,
                        "ready": false,
                        "rasaContainer": rasaContainer,
                        "ducklingContainer": ducklingContainer,
                        "models": [],
                        "inMemory": false
                    });
                }
            })();
        }, delay ? 4000 : 0);
    });
}

/**
 * createAndStartRasaContainer
 * @param {*} rasaImage 
 */
exports.createAndStartRasaContainer = async(rasaImage) => {
    spinner.text = 'Create ChatBot container...';
    let container = await dockerController.runImage({
        "name": "dockersuggar_rasa_nlu",
        "remove": false,
        "bgMode": true,
        "shell": null,
        "cmd": [],
        "ports": {
            "5000": "5000"
        },
        "volumes": {
            "/app/projects": dataController.NLU_PROJECT_FOLDER,
            "/app/logs": dataController.NLU_LOGS_FOLDER,
            "/app/data": dataController.NLU_DATA_FOLDER,
        }
    }, rasaImage);
    let containers = await dockerController.listContainers();
    let rasaContainer = containers.find(r => r.names == "/dockersuggar_rasa_nlu");
    return rasaContainer;
}

/**
 * createAndStartDucklingContainer
 * @param {*} ducklingImage 
 */
exports.createAndStartDucklingContainer = async(ducklingImage) => {
    spinner.text = 'Create Duckling container...';
    let container = await dockerController.runImage({
        "name": "dockersuggar_rasa_duckling",
        "remove": false,
        "bgMode": true,
        "shell": null,
        "cmd": [],
        "ports": {
            "8000": "8000"
        },
        "volumes": {}
    }, ducklingImage);
    let containers = await dockerController.listContainers();
    let ducklingContainer = containers.find(r => r.names == "/dockersuggar_rasa_duckling");
    return ducklingContainer;
}

/**
 * pullRasaImage
 */
exports.pullRasaImage = async(images) => {
    // Make sur we have the rasa image
    let rasaImage = images.find(r => r.repository == "rasa/rasa_nlu");

    if (!rasaImage) {
        spinner.stop();
        let questions = [{
            type: 'confirm',
            name: 'pullImage',
            message: 'Rasa NLU Image not installed. Intall it now?:',
            default: true
        }];

        let rasaAnswer = await prompt(questions);
        if (rasaAnswer.pullImage) {
            await dockerController.pullImage("rasa/rasa_nlu", {});
            images = await dockerController.listImages();
            return images.find(r => r.repository == "rasa/rasa_nlu");
        } else {
            return null; // Exit
        }
    } else {
        return rasaImage;
    }
}

/**
 * pullDucklingImage
 */
exports.pullDucklingImage = async(images) => {
    // Make sur we have the rasa image
    let ducklingImage = images.find(r => r.repository == "rasa/duckling");

    if (!ducklingImage) {
        spinner.stop();
        let questions = [{
            type: 'confirm',
            name: 'pullImage',
            message: 'Rasa Duckling Image not installed. Intall it now?:',
            default: true
        }];

        let ducklingAnswer = await prompt(questions);
        if (ducklingAnswer.pullImage) {
            await dockerController.pullImage("rasa/duckling", {});
            images = await dockerController.listImages();
            return images.find(r => r.repository == "rasa/duckling");
        } else {
            return null; // Exit
        }
    } else {
        return ducklingImage;
    }
}