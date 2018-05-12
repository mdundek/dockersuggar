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

        // RASA container is stopped or paused
        if (!status.online && status.rasaContainer) {
            // Start container if stopped
            if (status.rasaContainer.state == "stopped" || status.rasaContainer.state == "exited") {
                await dockerController.startContainer(status.rasaContainer);
            } else if (status.rasaContainer.state == "paused") {
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
        if (status.online && !status.model) {
            // Train model
            let respondedInTime = await self.trainModel();
            if (!respondedInTime) {
                // Timed out, try again later
                throw new Error("The dockersuggar model is not available yet, this migt take a couple of minutes. Please try again later.");
            }
            // Get status again, should all be good now
            status = await self.getStatus();
        }

        if (!status.online || !status.rasaContainer || !status.model) {
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
        let rasaImage = await self.pullRasaImage();
        spinner.start();
        if (rasaImage) {
            let containers = await dockerController.listContainers();
            let rasaContainer = containers.find(r => r.names == "/dockersuggar_rasa_nlu");
            if (rasaContainer) {
                spinner.text = 'Removing previous container instance...';
                await dockerController.deleteContainer(rasaContainer);
            }
            let container = await self.createAndStartContainer(rasaImage);
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
        spinner.text = 'Loading chatbot model, this might take up to a minute...';

        (async() => {
            let start = new Date().getTime();
            let timeout = 120 * 1000;
            try {
                let response = await request({
                    method: 'GET',
                    uri: 'http://localhost:5000/parse?q=Hello&project=dockersuggar',
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
                let dslDefinitionString = fs.readFileSync(path.join(__basedir, "resources", "rasa_nlu", "training", "dockersuggar.chatito")).toString();
                const dataset = chatito.datasetFromString(dslDefinitionString);
                let start = new Date().getTime();
                let timeout = 120 * 1000;
                try {
                    spinner.text = 'Training dockersuggar model, this might take some minutes...';
                    let response = await request({
                        method: 'POST',
                        uri: 'http://localhost:5000/train?project=dockersuggar',
                        body: dataset,
                        timeout: timeout,
                        json: true // Automatically stringifies the body to JSON
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
                let containers = await dockerController.listContainers();
                let rasaContainer = containers.find(r => r.names == "/dockersuggar_rasa_nlu");

                if (!rasaContainer) {
                    resolve({
                        "online": false,
                        "ready": false,
                        "model": null,
                        "rasaContainer": null,
                        "inMemory": false
                    });
                    return;
                }

                try {
                    let response = await request({
                        method: 'GET',
                        uri: 'http://localhost:5000/status',
                        json: true // Automatically stringifies the body to JSON
                    });

                    let ready = response.available_projects && response.available_projects.dockersuggar && response.available_projects.dockersuggar.status == "ready";
                    let loaded = ready ? (response.available_projects.dockersuggar.loaded_models.find(m => m != "fallback") ? true : false) : false;

                    if (response.available_projects && response.available_projects.dockersuggar && response.available_projects.dockersuggar.status == "ready") {
                        resolve({
                            "online": true,
                            "ready": ready,
                            "model": "dockersuggar",
                            "rasaContainer": rasaContainer,
                            "inMemory": loaded
                        });
                    } else {
                        resolve({
                            "online": true,
                            "ready": ready,
                            "model": null,
                            "rasaContainer": rasaContainer,
                            "inMemory": loaded
                        });
                    }
                } catch (e) {
                    resolve({
                        "online": false,
                        "ready": false,
                        "model": null,
                        "rasaContainer": rasaContainer,
                        "inMemory": false
                    });
                }
            })();
        }, delay ? 4000 : 0);
    });
}

/**
 * createAndStartContainer
 * @param {*} rasaImage 
 */
exports.createAndStartContainer = async(rasaImage) => {
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
 * pullRasaImage
 */
exports.pullRasaImage = async() => {
    // Make sur we have the rasa image
    let images = await dockerController.listImages();
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