"use strict"

const dockerController = require("./dockerController");
const dataController = require("./dataController");

var validator = require("validator");
var { prompt } = require('inquirer');
var fs = require("fs");
var exec = require('child_process').exec;
var path = require("path");
var chalk = require("chalk");

module.exports = {
    init: async() => {
        await dataController.init();
        await dockerController.init((err) => {
            throw err;
        });
    },
    updateSettings: async(settings) => {
        const questions = [{
            type: 'input',
            name: 'dockerimgbasepath',
            message: 'Please enter the path to your docker images (<base path>/<image name>/<tag>/Dockerfile) base folder:',
            validate: (path) => {
                return fs.existsSync(path) ? true : "Invalide path"
            }
        }];
        if (settings && settings.dockerimgbasepath) {
            questions[0].default = settings.dockerimgbasepath;
        }
        let imgpathresponse = await prompt(questions);

        return dataController.saveSettings(imgpathresponse);
    },
    /**
     * cleanupImages
     */
    cleanupImages: async() => {
        await dockerController.cleanupImages();
        console.log(chalk.grey("Done"));
    },
    /**
     * images
     */
    images: async() => {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images);
    },
    /**
     * dockerfiles
     */
    dockerfiles: async() => {
        let settings = await dataController.getSettings();
        if (!settings) {
            settings = await require("./promptController").updateSettings();
        }
        dataController.setBaseImagesPath(settings.dockerimgbasepath);

        let dockers = await dataController.getLocalDokerFiles();
        if (dockers.length == 0) {
            console.log(chalk.grey("No Dockerfiles found"));
            return;
        }
        displayAvailableDockerFiles(dockers);
    },
    /**
     * openDockerfile
     */
    openDockerfile: async() => {
        let settings = await dataController.getSettings();
        if (!settings) {
            settings = await require("./promptController").updateSettings();
        }
        dataController.setBaseImagesPath(settings.dockerimgbasepath);

        let dockers = await dataController.getLocalDokerFiles();
        if (dockers.length == 0) {
            console.log(chalk.grey("No docker files found"));
            return;
        }
        displayAvailableDockerFiles(dockers, true);

        const questions = [{
            type: 'input',
            name: 'index',
            message: 'Dockerfile to edit:',
            validate: (index) => {
                if (validateIndexResponse(dockers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let buildDockerfile = await prompt(questions);
        let sDockerfile = dockers[parseInt(buildDockerfile.index) - 1];
        exec(getCommandLine() + ' ' + path.join(sDockerfile.path, "Dockerfile"));
    },
    /**
     * containers
     */
    containers: async() => {
        let containers = await dockerController.listContainers();
        if (containers.length == 0) {
            console.log(chalk.grey("No containers found"));
            return;
        }
        displayAvailableContainers(containers);
    },
    /**
     * deleteImage
     */
    deleteImage: async() => {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);

        const questions = [{
            type: 'input',
            name: 'index',
            message: 'Image index to delete:',
            validate: (index) => {
                if (validateIndexResponse(images, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let delImgData = await prompt(questions);
        let deleteImage = images[parseInt(delImgData.index) - 1];
        await dockerController.deleteImage(deleteImage);
        console.log(chalk.grey("Done"));
    },
    /**
     * deleteContainer
     */
    deleteContainer: async() => {
        let containers = await dockerController.listContainers();
        if (containers.length == 0) {
            console.log(chalk.grey("No containers found"));
            return;
        }
        displayAvailableContainers(containers, true);

        const questions = [{
            type: 'input',
            name: 'index',
            message: "Container index to delete (ex: 1 or 1,3'):",
            validate: (index) => {
                let valide = true;
                index.split(",").forEach(i => {
                    if (!validateIndexResponse(containers, i.trim())) {
                        valide = "Invalide index";
                    }
                });
                return valide;
            }
        }];

        let delContainerData = await prompt(questions);
        let indexes = delContainerData.index.split(",");
        for (let i = 0; i < indexes.length; i++) {
            let deleteContainer = containers[parseInt(indexes[i].trim()) - 1];
            await dockerController.deleteContainer(deleteContainer);
        }

        console.log(chalk.grey("Done"));
    },
    /**
     * start
     */
    start: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => !c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no stopped containers"));
            return;
        }
        displayAvailableContainers(containers, true);

        const questions = [{
            type: 'input',
            name: 'index',
            message: 'Container index to start:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let qResponses = await prompt(questions);

        let container = containers[parseInt(qResponses.index) - 1];
        await dockerController.startContainer(container);
        console.log(chalk.grey("Done"));
    },
    /**
     * stop
     */
    stop: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no running containers"));
            return;
        }
        displayAvailableContainers(containers, true);

        const questions = [{
            type: 'input',
            name: 'index',
            message: 'Container index to stop:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let qResponses = await prompt(questions);

        let container = containers[parseInt(qResponses.index) - 1];
        await dockerController.stopContainer(container);
        console.log(chalk.grey("Done"));
    },
    /**
     * new
     */
    new: async() => {
        let settings = await dataController.getSettings();
        if (!settings) {
            settings = await require("./promptController").updateSettings();
        }
        dataController.setBaseImagesPath(settings.dockerimgbasepath);

        let questions = [{
            type: 'input',
            name: 'name',
            message: 'Name of the image:',
            validate: (data) => {
                return data.trim().length == 0 ? "Required" : true;
            }
        }, {
            type: 'input',
            name: 'tag',
            message: 'Tag:',
            default: '0.0.1',
            validate: (data) => {
                return data.trim().length == 0 ? "Required" : true;
            }
        }, {
            type: 'input',
            name: 'baseimage',
            message: 'Base image:',
            validate: (data) => {
                return data.trim().length == 0 ? "Required" : true;
            }
        }, {
            type: 'input',
            name: 'expose',
            message: 'Expose ports:'
        }];

        let newImageDetails = await prompt(questions);

        if (newImageDetails.name.trim().length == 0) {
            console.log(chalk.red("Name can not be empty"));
        } else if (newImageDetails.tag.trim().length == 0) {
            console.log(chalk.red("Tag can not be empty"));
        } else if (newImageDetails.baseimage.trim().length == 0) {
            console.log(chalk.red("Base Image can not be empty"));
        } else {
            let imgFolder = path.join(dataController.IMAGE_BASE_DIR, newImageDetails.name, newImageDetails.tag);
            if (fs.existsSync(imgFolder)) {
                console.log(chalk.red("Docker image / tag already exists"));
            } else {
                if (!fs.existsSync(path.join(dataController.IMAGE_BASE_DIR, newImageDetails.name))) {
                    fs.mkdirSync(path.join(dataController.IMAGE_BASE_DIR, newImageDetails.name));
                }
                fs.mkdirSync(imgFolder);
                dockerController.createDockerfile(imgFolder, newImageDetails);
                console.log(chalk.grey("Done"));
            }
        }
    },
    /**
     * build
     */
    build: async() => {
        let settings = await dataController.getSettings();
        if (!settings) {
            settings = await require("./promptController").updateSettings();
        }
        dataController.setBaseImagesPath(settings.dockerimgbasepath);

        let dockers = await dataController.getLocalDokerFiles();
        if (dockers.length == 0) {
            console.log(chalk.grey("No docker files found"));
            return;
        }
        displayAvailableDockerFiles(dockers, true);

        const questions = [{
                type: 'input',
                name: 'index',
                message: 'Docker file to build:',
                validate: (index) => {
                    if (validateIndexResponse(dockers, index)) {
                        return true;
                    } else {
                        return "Invalide index";
                    }
                }
            },
            {
                type: 'input',
                name: 'registry',
                message: 'Registry (Optional):'
            },
            {
                type: 'input',
                name: 'phone',
                message: 'Repository / Namespace (Optional):'
            }
        ];

        let buildDockerfile = await prompt(questions);

        let sDockerfile = dockers[parseInt(buildDockerfile.index) - 1];
        let code = await dockerController.buildDockerfile(
            buildDockerfile,
            sDockerfile,
            (stdOut) => {
                console.log(stdOut);
            },
            (stdErr) => {
                console.log(stdErr);
            }
        );
        if (code == 0) {
            console.log("\n" + chalk.grey("Done"));
        } else {
            console.log("\n" + chalk.red("An error occured"));
        }
    },
    /**
     * tag
     */
    tag: async() => {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);
        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Image to tag:',
            validate: (index) => {
                if (validateIndexResponse(images, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }, {
            type: 'input',
            name: 'registry',
            message: 'Registry (Optional):'
        }, {
            type: 'input',
            name: 'phone',
            message: 'Repository / Namespace (Optional):'
        }];

        let tagImageData = await prompt(questions);

        let sImage = dockers[parseInt(tagImageData.index) - 1];
        let code = await dockerController.tagImage(
            sImage,
            tagImageData,
            (stdOut) => {
                console.log(stdOut);
            },
            (stdErr) => {
                console.log(stdErr);
            }
        );
        if (code == 0) {
            console.log("\n" + chalk.grey("Done"));
        } else {
            console.log("\n" + chalk.red("An error occured"));
        }
    },
    /**
     * push
     */
    push: async() => {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);
        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Image to push:',
            validate: (index) => {
                if (validateIndexResponse(images, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }, {
            type: 'input',
            name: 'registry',
            message: 'Registry (Optional):'
        }, {
            type: 'input',
            name: 'phone',
            message: 'Repository / Namespace (Optional):'
        }];

        let pushImageData = await prompt(questions);

        let sImage = dockers[parseInt(pushImageData.index) - 1];
        let code = await dockerController.pushImage(
            sImage,
            pushImageData,
            (stdOut) => {
                console.log(stdOut);
            },
            (stdErr) => {
                console.log(stdErr);
            }
        );
        if (code == 0) {
            console.log("\n" + chalk.grey("Done"));
        } else {
            console.log("\n" + chalk.red("An error occured"));
        }
    },
    /**
     * run
     */
    run: async() => {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);
        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Image to run:',
            validate: (index) => {
                if (validateIndexResponse(images, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let runImageIndex = await prompt(questions);

        let sImage = images[parseInt(runImageIndex.index) - 1];
        let previousRunSettings = await dataController.lookupImageRunConfig(sImage);
        let imageConfig = await dataController.lookupImageConfig(sImage);
        if (imageConfig && imageConfig.config) {
            console.log("---------------------- Image documentation ----------------------");

            if (imageConfig.config.description.trim().length > 0) {
                console.log("");
                console.log(chalk.yellow("Description:"));
                console.log(imageConfig.config.description);
            }
            let ports = Object.keys(imageConfig.config.ports);
            let volumes = Object.keys(imageConfig.config.volumes);
            let envs = Object.keys(imageConfig.config.env);
            if (ports.length > 0) {
                console.log("");
                console.log(chalk.yellow("Exposed ports:"));
                ports.forEach((port) => {
                    console.log(chalk.grey(port) + " (" + imageConfig.config.ports[port] + ")");
                });
            }
            if (volumes.length > 0) {
                console.log("");
                console.log(chalk.yellow("Volumes:"));
                volumes.forEach((volume) => {
                    console.log(chalk.grey(volume) + " (" + imageConfig.config.volumes[volume] + ")");
                });
            }
            if (envs.length > 0) {
                console.log("");
                console.log(chalk.yellow("Environement variables:"));
                envs.forEach((env) => {
                    console.log(chalk.grey(env) + " (" + imageConfig.config.env[env] + ")");
                });
            }
            console.log("-----------------------------------------------------------------");
            console.log("");
        }

        let existingContainers = await dockerController.listContainers();
        // ************ PROMPT: Init detailed questions params ************
        questions = [{
            type: 'input',
            name: 'name',
            message: 'Container name:',
            validate: (res) => {
                let valide = true;
                if (res.trim().length == 0) {
                    valide = "Mandatory field";
                } else if (existingContainers.find(c => c.names.toLowerCase() == res.toLowerCase()) != null) {
                    valide = "Container name already in use";
                }
                return valide;
            }
        }, {
            type: 'confirm',
            name: 'remove',
            message: 'Remove container on exit:',
            default: false
        }, {
            type: 'confirm',
            name: 'bgMode',
            message: 'Do you want to run this container in detached mode:',
            default: true
        }];
        // Populate default values for those params if a previous run has been found
        if (previousRunSettings) {
            questions = questions.map((s) => {
                s.default = previousRunSettings.settings[s.name];
                return s;
            });
        }

        let runImageData = await prompt(questions);

        // ************ PROMPT: Shell mode ************
        if (!runImageData.bgMode) {
            questions = [{
                type: 'confirm',
                name: 'shell',
                message: 'Do you wish to log into this container:',
                default: false
            }];
            // Populate default values for those params if a previous run has been found
            if (previousRunSettings && previousRunSettings.settings.shell) {
                questions[0].default = previousRunSettings.settings.shell;
            }

            // Prompt user with questions
            let shellQuestionResponse = await prompt(questions);

            // runImageData.shell = shellQuestionResponse.shell;
            // map responses to final values if necessary
            runImageData.shell = shellQuestionResponse.shell;

            if (runImageData.shell) {
                // ************ PROMPT: Shell type ************
                questions = [{
                    type: 'list',
                    name: 'shellType',
                    message: 'Shell type:',
                    choices: ["/bin/bash", "sh"],
                    default: "/bin/bash"
                }];
                // Populate default values for those params if a previous run has been found
                if (previousRunSettings && previousRunSettings.settings.shellType) {
                    questions[0].default = previousRunSettings.settings.shellType;
                }
                // Prompt user with questions
                let shellTypeQuestionResponse = await prompt(questions);
                runImageData.shellType = shellTypeQuestionResponse.shellType;
            } else {
                // ************ PROMPT: Extra command ************
                questions = [{
                    type: 'input',
                    name: 'cmd',
                    message: 'Optional container command parameters:'
                }];
                // Populate default values for those params if a previous run has been found
                if (previousRunSettings && previousRunSettings.settings.cmd && previousRunSettings.settings.cmd.length > 0) {
                    questions[0].default = previousRunSettings.settings.cmd;
                }
                // Prompt user with questions
                let cmdQuestionResponse = await prompt(questions);
                runImageData.cmd = cmdQuestionResponse.cmd;
            }
        }

        // ************ PROMPT: Ports ************
        let pSettings = {};
        if (previousRunSettings && previousRunSettings.settings.ports && Object.keys(previousRunSettings.settings.ports).length > 0) {
            pSettings = previousRunSettings.settings.ports;
        } else {
            // Get exposed ports from Dockerfile
            let ports = dataController.extractExposedPorts(sImage);
            if (ports && ports.length > 0) {
                ports.map(p => {
                    pSettings[p] = p;
                });
            }
        }

        let portResult = await promptForRepetingValues({
            "intro": "Port mapping",
            "key": "Container port",
            "value": "Host port"
        }, pSettings, ":", true);
        runImageData.ports = portResult;

        // ************ PROMPT: Volumes ************
        let vSettings = {};
        if (previousRunSettings && previousRunSettings.settings.volumes && Object.keys(previousRunSettings.settings.volumes).length > 0) {
            vSettings = previousRunSettings.settings.volumes;
        } else {
            // Get exposed volumes from Dockerfile
            let volumes = dataController.extractDockerfileVolumes(sImage);
            if (volumes && volumes.length > 0) {
                volumes.map(v => {
                    vSettings[v] = v;
                });
            }
        }

        let volResult = await promptForRepetingValues({
            "intro": "Volume mapping",
            "key": "Container volume path",
            "value": "Host volume path"
        }, vSettings, ":", true);
        runImageData.volumes = volResult;

        // ************ PROMPT: Environement variables ************
        let envResult = await promptForRepetingValues({
            "intro": "Environement variables",
            "key": "Environement variable name",
            "value": "Environement variable value"
        }, previousRunSettings && previousRunSettings.settings.env ? previousRunSettings.settings.env : null);
        runImageData.env = envResult;

        // Save user selected params for this image for next run
        await dataController.saveImageRunConfig(sImage, runImageData);

        // Now run docker command
        let code = await dockerController.runImage(
            runImageData,
            sImage,
            (stdOut) => {
                console.log(stdOut);
            },
            (stdErr) => {
                console.log(stdErr);
            }
        );
        // If success
        if (code == 0) {
            let containers = await dockerController.listContainers();
            let rc = containers.find(c => c.names == runImageData.name);
            if (rc) {
                let data = await dockerController.inspectContainer(rc, "network");
                console.log("");
                displayInspectData("network", data);

                data = await dockerController.inspectContainer(rc, "bindings");
                displayInspectData("bindings", data);

                data = await dockerController.inspectContainer(rc, "volumes");
                displayInspectData("volumes", data);
            }
            console.log(chalk.grey("\nDone"));
        }
        // On error
        else {
            delete
            console.log("\n" + chalk.red("An error occured"));
        }
    },
    /**
     * inspectContainer
     */
    inspectContainer: async(target) => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no running containers"));
            return;
        }

        displayAvailableContainers(containers, true);

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container number to inspect:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let indexData = await prompt(questions);
        let bashContainer = containers[parseInt(indexData.index) - 1];
        let data = await dockerController.inspectContainer(bashContainer, target);

        displayInspectData(target, data);
    },
    /**
     * bashInContainer
     */
    bashInContainer: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no running containers"));
            return;
        }

        displayAvailableContainers(containers, true);

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container number to start a bash session in:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let indexData = await prompt(questions);
        let bashContainer = containers[parseInt(indexData.index) - 1];
        await dockerController.bashInContainer(bashContainer);
        console.log(chalk.grey("Done"));
    },
    /**
     * containerLogs
     */
    containerLogs: async() => {
        let containers = await dockerController.listContainers();
        if (containers.length == 0) {
            console.log(chalk.grey("There are no containers"));
            return;
        }

        displayAvailableContainers(containers, true);

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container number to get the logs for:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let indexData = await prompt(questions);
        let bashContainer = containers[parseInt(indexData.index) - 1];
        await dockerController.containerLogs(bashContainer,
            (stdOut) => {
                console.log(stdOut);
            },
            (stdErr) => {
                console.log(stdErr);
            });
        console.log(chalk.grey("Done"));
    },
    /**
     * execInContainer
     */
    execInContainer: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no running containers"));
            return;
        }

        displayAvailableContainers(containers, true);

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container number to execute command in:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }, {
            type: 'input',
            name: 'command',
            message: 'Command to execute:',
            validate: (data) => {
                return data.trim().length == 0 ? "Required" : true;
            }
        }];

        let containerData = await prompt(questions);
        let execInContainer = containers[parseInt(containerData.index) - 1];
        await dockerController.execInContainer(execInContainer, containerData.command);
        console.log(chalk.grey("Done"));
    },
    /**
     * commentImage
     */
    commentImage: async() => {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Document image:',
            validate: (index) => {
                if (validateIndexResponse(images, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let docImageIndex = await prompt(questions);
        let sImage = images[parseInt(docImageIndex.index) - 1];

        let previousConfig = await dataController.lookupImageConfig(sImage);
        if (!previousConfig) {
            previousConfig = {
                "repository": sImage.repository,
                "tag": sImage.tag,
                "config": {}
            };
        }

        questions = [{
            type: 'input',
            name: 'description',
            message: 'Short description:',
            default: previousConfig.config.description ? previousConfig.config.description : null
        }];

        console.log("");

        let description = await prompt(questions);

        previousConfig.config.description = description.description;

        let portResult = await promptForRepetingValues({
            "intro": "Port mapping",
            "key": "Container port",
            "value": "Details"
        }, previousConfig.config.ports ? previousConfig.config.ports : {}, " => ", false);

        let volumeResult = await promptForRepetingValues({
            "intro": "Volume mapping",
            "key": "Container volume path",
            "value": "Details"
        }, previousConfig.config.volumes ? previousConfig.config.volumes : {}, " => ", false);

        let envResult = await promptForRepetingValues({
            "intro": "Environement variables",
            "key": "Variable name",
            "value": "Description"
        }, previousConfig.config.env ? previousConfig.config.env : {}, " => ", false);

        previousConfig.config.ports = portResult;
        previousConfig.config.volumes = volumeResult;
        previousConfig.config.env = envResult;

        await dataController.saveImageConfig(sImage, previousConfig.config);

        console.log("\n" + chalk.grey("Done"));
    }
};

/**
 * promptForRepetingValues
 * @param {*} labels 
 * @param {*} existingList 
 */
let promptForRepetingValues = async(labels, existingList, separator, invert) => {
    return new Promise((resolve, reject) => {
        console.log("");
        console.log(chalk.yellow(labels.intro + ":"));
        let currentList = !existingList ? {} : Object.assign({}, existingList);
        const iterate = () => {
            let i = 1;
            console.log("");
            if (Object.keys(currentList).length == 0) {
                console.log(chalk.grey("  -None-"));
            }
            for (let e in currentList) {
                if (invert) {
                    console.log(
                        chalk.cyan(currentList[e]) +
                        (separator ? separator : "=") +
                        chalk.cyan(e)
                    );
                } else {
                    console.log(
                        chalk.cyan(e) +
                        (separator ? separator : "=") +
                        chalk.cyan(currentList[e])
                    );
                }
            }

            (async() => {
                let noDel = Object.keys(currentList).length == 0;

                console.log("");
                let choice = await askAddUpdateDelDone("What do you wish to do", noDel);

                if (choice) {
                    if (choice == "add") {
                        let questions = [{
                            type: 'input',
                            name: 'key',
                            message: labels.key,
                            validate: (res) => {
                                return res.trim().length == 0 ? "Mandatory field" : true
                            }
                        }, {
                            type: 'input',
                            name: 'value',
                            message: labels.value,
                            validate: (res) => {
                                return res.trim().length == 0 ? "Mandatory field" : true
                            }
                        }];

                        // Prompt user with questions
                        let addDetails = await prompt(questions);
                        currentList[addDetails.key] = addDetails.value;
                        iterate();
                    } else if (choice == "remove") {
                        let questions = [{
                            type: 'list',
                            name: 'delValue',
                            message: 'Remove:',
                            choices: []
                        }];

                        for (let e in currentList) {
                            if (invert) {
                                questions[0].choices.push(
                                    currentList[e] +
                                    (separator ? separator : "=") +
                                    e
                                );
                            } else {
                                questions[0].choices.push(
                                    e +
                                    (separator ? separator : "=") +
                                    currentList[e]
                                );
                            }
                        }
                        let delItem = await prompt(questions);

                        // delItem.delValue
                        for (let e in currentList) {
                            if (invert) {
                                if ((currentList[e] + (separator ? separator : "=") + e) == delItem.delValue) {
                                    delete currentList[e];
                                }
                            } else {
                                if ((e + (separator ? separator : "=") + currentList[e]) == delItem.delValue) {
                                    delete currentList[e];
                                }
                            }
                        }

                        iterate();
                    } else if (choice == "done") {
                        console.log("");
                        resolve(currentList);
                    } else {
                        resolve(null);
                    }
                }
            })();
        }

        iterate();
    });
};

/**
 * askAddUpdateDelDone
 * @param {*} questionText 
 * @param {*} noDel 
 */
let askAddUpdateDelDone = (questionText, noDel) => {
    return new Promise((resolve, reject) => {
        let questions;
        if (noDel) {
            questions = [{
                type: 'list',
                name: 'uchoice',
                message: questionText,
                choices: ['Add', 'Done'],
                default: 'Done'
            }];
        } else {
            questions = [{
                type: 'list',
                name: 'uchoice',
                message: questionText,
                choices: ['Add / update', 'Remove', 'Done'],
                default: 'Done'
            }];
        }
        (async() => {
            let response = await prompt(questions);

            if (response && (response.uchoice == "Add" || response.uchoice == "Add / update")) {
                resolve("add");
            } else if (response && (response.uchoice == "Remove")) {
                resolve("remove");
            } else if (response && (response.uchoice == "Done")) {
                resolve("done");
            } else {
                resolve();
            }
        })();
    });
};

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

/**
 * displayAvailableImages
 * @param {*} images 
 * @param {*} numbered 
 */
let displayAvailableImages = (images, numbered) => {
    images.forEach((image, i) => {
        console.log(
            (numbered ? ((i + 1) + ": ") : "") +
            chalk.redBright(image.repository) +
            chalk.yellow(" (" + image.tag + ")") +
            chalk.grey(" - ID " + image["image id"] + ", SIZE " + image["size"])
        );
    });
}

/**
 * displayAvailableContainers
 * @param {*} containers
 * @param {*} numbered 
 */
let displayAvailableContainers = (containers, numbered) => {
    containers.forEach((container, i) => {
        let line = chalk.redBright(container["names"]) + " - ID " + container["container id"] + ", created " + container["created"];
        if (container["up"]) {
            line = chalk.green("Up:   " + line);
        } else {
            line = chalk.grey("Down: " + line);
        }
        console.log(
            (numbered ? ((i + 1) + ": ") : "") +
            line +
            " (IMAGE ID " + (container.image ? container.image["image id"] : "?") + " -> " + (container.image ? chalk.yellow(container.image.repository + ":" + container.image.tag) : "n/a") + ")"
        );
    });
}

/**
 * displayAvailableImages
 * @param {*} images 
 * @param {*} numbered 
 */
let displayAvailableDockerFiles = (dockers, numbered) => {
    dockers.forEach((d, i) => {
        console.log(
            (numbered ? ((i + 1) + ": ") : "") + chalk.magenta(d.repository) + chalk.yellow(" (" + d.tag + ")")
        );
    });
}

/**
 * displayInspectData
 * @param {*} target 
 * @param {*} data 
 */
let displayInspectData = (target, data) => {
    if (target == "network") {
        console.log("CONTAINER HOSTNAME: " + chalk.cyan(data.Hostname));
        console.log("CONTAINER IP: " + chalk.cyan(data.IPAddress));
        for (let p in data.Ports) {
            console.log(
                "PORT: " +
                chalk.cyan(p) +
                " => " +
                (data.Ports[p] ?
                    "Host mapping " + chalk.cyan(data.Ports[p].map(l => l.HostIp + ":" + l.HostPort).join(", ")) :
                    "No host mappings")
            );
        }
    } else if (target == "image") {
        console.log("IMAGE: " + chalk.cyan(data));
    } else if (target == "bindings") {
        if (data) {
            data = data.map(d => d.split(":"));
            data.forEach(d => {
                console.log("BINDING: " + chalk.cyan(d[1]) + " => Host folder " + chalk.cyan(d[0]));
            });
        } else {
            console.log("BINDINGS: " + chalk.cyan("none"));
        }
    } else if (target == "volumes") {
        for (let v in data) {
            console.log("VOLUME: " + chalk.cyan(v));
        }
    } else {
        console.log(data);
    }
}

/**
 * getCommandLine
 */
let getCommandLine = () => {
    switch (process.platform) {
        case 'darwin':
            return 'open';
        case 'win32':
            return 'start';
        case 'win64':
            return 'start';
        default:
            return 'xdg-open';
    }
}