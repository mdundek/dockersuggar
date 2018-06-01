"use strict"

const dockerController = require("./dockerController");
const dataController = require("./dataController");

var validator = require("validator");
var { prompt } = require('inquirer');
var fs = require("fs");
var exec = require('child_process').exec;
var path = require("path");
var chalk = require("chalk");

let specialCharactersRegex = /^[_A-z0-9]*$/g;

module.exports = {
    init: async() => {
        await dataController.init();
    },
    updateSettings: async(specific) => {
        let settings = await dataController.getSettings();
        const questions = [];

        if (!specific || specific == "dockerimgbasepath") {
            questions.push({
                type: 'input',
                name: 'dockerimgbasepath',
                message: 'Please enter the base path to your docker images (' + chalk.red('<base path>') + '/<image name>/<tag>/Dockerfile) base folder:',
                validate: (path) => {
                    return fs.existsSync(path) ? true : "Invalide path"
                }
            });
            if (settings && settings.dockerimgbasepath) {
                questions[questions.length - 1].default = settings.dockerimgbasepath;
            }
        }

        let settingsResponse = await prompt(questions);
        if (settings) {
            settingsResponse = Object.assign(settings, settingsResponse);
        }

        return dataController.saveSettings(settingsResponse);
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
        console.log("");

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
        console.log("");

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
        console.log("");

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
    start: async(args) => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => !c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no stopped containers"));
            return;
        }
        displayAvailableContainers(containers, true);
        console.log("");

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
        await dockerController.startContainer(container, args);
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
        console.log("");

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
     * pause
     */
    pause: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up && c.state != "paused");
        if (containers.length == 0) {
            console.log(chalk.grey("There are no running containers"));
            return;
        }
        displayAvailableContainers(containers, true);
        console.log("");

        const questions = [{
            type: 'input',
            name: 'index',
            message: 'Container index to pause:',
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
        await dockerController.pauseContainer(container);
        console.log(chalk.grey("Done"));
    },
    /**
     * unpause
     */
    unpause: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.state == "paused");
        if (containers.length == 0) {
            console.log(chalk.grey("There are no paused containers"));
            return;
        }
        displayAvailableContainers(containers, true);
        console.log("");

        const questions = [{
            type: 'input',
            name: 'index',
            message: 'Container index to unpause:',
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
        await dockerController.unpauseContainer(container);
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
                if (data.trim().length == 0) {
                    return "Required";
                } else if (data.match(specialCharactersRegex) == null) {
                    return "No special characters allowed";
                } else {
                    return true;
                }
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
        console.log("");

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
                name: 'repository',
                message: 'Repository / Namespace (Optional):'
            }
        ];

        let buildDockerfile = await prompt(questions);

        let sDockerfile = dockers[parseInt(buildDockerfile.index) - 1];
        await dockerController.buildDockerfile(buildDockerfile, sDockerfile);
        console.log("\n" + chalk.grey("Done"));
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
        console.log("");

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
            name: 'repository',
            message: 'Repository / Namespace (Optional):'
        }];

        let tagImageData = await prompt(questions);

        let sImage = images[parseInt(tagImageData.index) - 1];
        await dockerController.tagImage(sImage, tagImageData);
        console.log("\n" + chalk.grey("Done"));
    },
    /**
     * pull
     */
    pull: async() => {
        let data = await promptRepoAuth();

        await dockerController.pullImage(data.image, data.auth);
        console.log("\n" + chalk.grey("Done"));
    },
    /**
     * push
     */
    push: async() => {
        let data = await promptRepoAuth(true);

        await dockerController.pushImage(data.localImage, data.auth);
        console.log("\n" + chalk.grey("Done"));
    },
    /**
     * run
     */
    run: async() => {
        // ************************************************************
        // ************************** IMAGE ***************************
        // ************************************************************
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);
        console.log("");

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

        // ************************************************************
        // ********************** DOCUMENTATION ***********************
        // ************************************************************
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

        // ************************************************************
        // ********************* GLOBAL SETTINGS **********************
        // ************************************************************
        questions = [{
            type: 'input',
            name: 'name',
            message: 'Container name:',
            validate: (data) => {
                if (data.trim().length == 0) {
                    return "Required";
                } else if (data.match(specialCharactersRegex) == null) {
                    return "No special characters allowed";
                } else if (existingContainers.find(c => c.names.toLowerCase() == "/" + data.toLowerCase()) != null) {
                    return "Container name already in use";
                } else {
                    return true;
                }
            }
        }, {
            type: 'confirm',
            name: 'blocking',
            message: 'Does or will this container run a blocking process (server, db...):',
            default: true
        }, {
            type: 'confirm',
            name: 'remove',
            message: 'Remove container on exit:',
            default: false
        }, {
            type: 'confirm',
            name: 'network',
            message: 'Link the container to an existing network:',
            default: false
        }];
        // Populate default values for those params if a previous run has been found
        if (previousRunSettings) {
            questions = questions.map((s) => {
                s.default = previousRunSettings.settings[s.name];
                return s;
            });
        }

        let runImageData = await prompt(questions);

        if (runImageData.network) {
            let networks = await dockerController.listNetworks();
            if (networks.length == 0) {
                console.log(chalk.grey("No networks found"));
                return;
            }

            questions = [{
                type: 'list',
                name: 'networkName',
                message: 'Network to link container to:',
                choices: []
            }];

            networks.forEach(n => {
                questions[0].choices.push(n.Name);
            });

            if (previousRunSettings) {
                let previousNetwork = networks.find(n => n.Id == previousRunSettings.settings["networkId"]);
                if (previousNetwork) {
                    questions[0].default = previousNetwork.Name;
                }
            }
            let networkNameAnswer = await prompt(questions);
            let network = networks.find(n => n.Name == networkNameAnswer.networkName);

            runImageData.networkId = network.Id;
        }

        // ************************************************************
        // ************************** PORTS ***************************
        // ************************************************************
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

        let portResult = await promptForRepetingKeyValues({
            "intro": "Port mapping",
            "key": "Container port",
            "value": "Host port",
            "valuePostShort": " (Host)"
        }, pSettings, " : ");
        runImageData.ports = portResult;

        // ************************************************************
        // ************************* VOLUMES **************************
        // ************************************************************
        let vSettings = {};
        if (previousRunSettings && previousRunSettings.settings.volumes && Object.keys(previousRunSettings.settings.volumes).length > 0) {
            vSettings = previousRunSettings.settings.volumes;
        } else {
            // Get exposed volumes from Dockerfile
            // let volumes = dataController.extractDockerfileVolumes(sImage);
            // if (volumes && volumes.length > 0) {
            //     volumes.map(v => {
            //         vSettings[v] = v;
            //     });
            // }
        }

        let volResult = await promptForRepetingKeyValues({
            "intro": "Volume mapping",
            "key": "Container volume path",
            "value": "Host volume path",
            "valuePostShort": " (Host)"
        }, vSettings, " : ", false, true);
        runImageData.volumes = volResult;

        // ************************************************************
        // ******************* ENVIRONEMENT VARIABLES *****************
        // ************************************************************
        let envResult = await promptForRepetingKeyValues({
            "intro": "Environement variables",
            "key": "Environement variable name",
            "value": "Environement variable value"
        }, previousRunSettings && previousRunSettings.settings.env ? previousRunSettings.settings.env : null);
        runImageData.env = envResult;

        // ************************************************************
        // ************************** BLOCKING ************************
        // ************************************************************
        if (runImageData.blocking) {
            questions = [{
                type: 'list',
                name: 'bgMode',
                message: "Detach container?",
                choices: ['Yes', 'No'],
                default: 'Yes'
            }];

            if (previousRunSettings && previousRunSettings.settings) {
                questions[0].default = previousRunSettings.settings.bgMode ? "Yes" : "No";
            }

            let bgModeQuestion = await prompt(questions);
            runImageData.bgMode = bgModeQuestion.bgMode == "Yes";

            // ************************************************************
            // ************************** BG MODE *************************
            // ************************************************************
            if (runImageData.bgMode) {
                runImageData.shell = false;

                questions = [{
                    type: 'list',
                    name: 'replaceCmd',
                    message: "Do you want to replace the container default command?",
                    choices: ['Yes', 'No'],
                    default: 'No'
                }];

                if (previousRunSettings && previousRunSettings.settings) {
                    questions[0].default = previousRunSettings.settings.cmd && previousRunSettings.settings.cmd.length > 0 ? "Yes" : "No";
                }

                let cmdQuestion = await prompt(questions);

                // ************************************************************
                // ************************ CMD REPLACE ***********************
                // ************************************************************
                if (cmdQuestion.replaceCmd == "Yes") {
                    let commandsResult = await promptForRepetingValue({
                        "intro": "Execute commands",
                        "value": "Command"
                    }, previousRunSettings && previousRunSettings.settings.cmd ? previousRunSettings.settings.cmd : null);
                    runImageData.cmd = commandsResult && commandsResult.length > 0 ? commandsResult : null;
                } else {
                    runImageData.cmd = null;
                }
            }
        }
        // ************************************************************
        // *********************** NON BLOCKING ***********************
        // ************************************************************
        else {
            runImageData.bgMode = false;
        }

        // ************************************************************
        // *********** LIVE MODE (NOT RUNNING IN BACKGROUND) **********
        // ************************************************************
        if (!runImageData.bgMode) {
            let choices = [
                'By attaching a shell',
                'With my commands',
                'Don\'t overwrite command'
            ];
            questions = [{
                type: 'list',
                name: 'replaceCmd',
                message: "Overwrite default container command?",
                choices: choices,
                default: choices[2]
            }];

            if (previousRunSettings && previousRunSettings.settings && previousRunSettings.settings.replaceCmd) {
                questions[0].default = previousRunSettings.settings.replaceCmd;
            }

            let replaceCmdQuestion = await prompt(questions);
            runImageData.replaceCmd = replaceCmdQuestion.replaceCmd;

            // ************************************************************
            // ******************** SHELL INTO CONTAINER ******************
            // ************************************************************
            if (choices.indexOf(runImageData.replaceCmd) == 0) {
                runImageData.shell = true;
                runImageData.cmd = null;
            }
            // ************************************************************
            // ********************* OVERWRITE COMMAND ********************
            // ************************************************************
            else if (choices.indexOf(runImageData.replaceCmd) == 1) {
                runImageData.shell = false;

                let commandsResult = await promptForRepetingValue({
                    "intro": "Execute commands",
                    "value": "Command"
                }, previousRunSettings && previousRunSettings.settings.cmd ? previousRunSettings.settings.cmd : null);
                runImageData.cmd = commandsResult && commandsResult.length > 0 ? commandsResult : null;
            }
            // ************************************************************
            // ****************** DONT OVERWRITE COMMAND ******************
            // ************************************************************
            else if (choices.indexOf(runImageData.replaceCmd) == 2) {
                runImageData.shell = false;
                runImageData.cmd = null;
            }
        }

        // Save user selected params for this image for next run
        await dataController.saveImageRunConfig(sImage, runImageData);
        // console.log(runImageData);

        // // Now run docker command
        let container = await dockerController.runImage(runImageData, sImage);
        if (runImageData.bgMode) {
            let data = await dockerController.inspectContainer(container);
            console.log("");

            displayInspectData("image", data.image);
            displayInspectData("network", data.network);
            displayInspectData("bindings", data.bindings);
            displayInspectData("volumes", data.volumes);
        }

        console.log(chalk.grey("\nDone"));
    },
    /**
     * create
     */
    create: async() => {
        // ************************************************************
        // ************************** IMAGE ***************************
        // ************************************************************
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Image to create a container from:',
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

        // ************************************************************
        // ********************** DOCUMENTATION ***********************
        // ************************************************************
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

        // ************************************************************
        // ********************* GLOBAL SETTINGS **********************
        // ************************************************************
        questions = [{
            type: 'input',
            name: 'name',
            message: 'Container name:',
            validate: (data) => {
                if (data.trim().length == 0) {
                    return "Required";
                } else if (data.match(specialCharactersRegex) == null) {
                    return "No special characters allowed";
                } else if (existingContainers.find(c => c.names.toLowerCase() == "/" + data.toLowerCase()) != null) {
                    return "Container name already in use";
                } else {
                    return true;
                }
            }
        }, {
            type: 'confirm',
            name: 'remove',
            message: 'Remove container on exit:',
            default: false
        }, {
            type: 'confirm',
            name: 'network',
            message: 'Link the container to an existing network:',
            default: false
        }];
        // Populate default values for those params if a previous run has been found
        if (previousRunSettings) {
            questions = questions.map((s) => {
                s.default = previousRunSettings.settings[s.name];
                return s;
            });
        }

        let runImageData = await prompt(questions);

        if (runImageData.network) {
            let networks = await dockerController.listNetworks();
            if (networks.length == 0) {
                console.log(chalk.grey("No networks found"));
                return;
            }

            questions = [{
                type: 'list',
                name: 'networkName',
                message: 'Network to link container to:',
                choices: []
            }];

            networks.forEach(n => {
                questions[0].choices.push(n.Name);
            });

            if (previousRunSettings) {
                let previousNetwork = networks.find(n => n.Id == previousRunSettings.settings["networkId"]);
                if (previousNetwork) {
                    questions[0].default = previousNetwork.Name;
                }
            }
            let networkNameAnswer = await prompt(questions);
            let network = networks.find(n => n.Name == networkNameAnswer.networkName);

            runImageData.networkId = network.Id;
        }

        // ************************************************************
        // ************************** PORTS ***************************
        // ************************************************************
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

        let portResult = await promptForRepetingKeyValues({
            "intro": "Port mapping",
            "key": "Container port",
            "value": "Host port",
            "valuePostShort": " (Host)"
        }, pSettings, " : ");
        runImageData.ports = portResult;

        // ************************************************************
        // ************************* VOLUMES **************************
        // ************************************************************
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

        let volResult = await promptForRepetingKeyValues({
            "intro": "Volume mapping",
            "key": "Container volume path",
            "value": "Host volume path",
            "valuePostShort": " (Host)"
        }, vSettings, " : ", false, true);
        runImageData.volumes = volResult;

        // ************************************************************
        // ******************* ENVIRONEMENT VARIABLES *****************
        // ************************************************************
        let envResult = await promptForRepetingKeyValues({
            "intro": "Environement variables",
            "key": "Environement variable name",
            "value": "Environement variable value"
        }, previousRunSettings && previousRunSettings.settings.env ? previousRunSettings.settings.env : null);
        runImageData.env = envResult;

        // ************************************************************
        // ************************* DEFAULTS *************************
        // ************************************************************
        runImageData.bgMode = true;
        runImageData.shell = false;

        // ************************************************************
        // ************************* COMMANDS *************************
        // ************************************************************
        questions = [{
            type: 'list',
            name: 'replaceCmd',
            message: "Do you want to replace the container default command?",
            choices: ['Yes', 'No'],
            default: 'No'
        }];

        if (previousRunSettings && previousRunSettings.settings) {
            questions[0].default = previousRunSettings.settings.cmd && previousRunSettings.settings.cmd.length > 0 ? "Yes" : "No";
        }

        let cmdQuestion = await prompt(questions);

        // ************************************************************
        // ************************ CMD REPLACE ***********************
        // ************************************************************
        if (cmdQuestion.replaceCmd == "Yes") {
            let commandsResult = await promptForRepetingValue({
                "intro": "Execute commands",
                "value": "Command"
            }, previousRunSettings && previousRunSettings.settings.cmd ? previousRunSettings.settings.cmd : null);
            runImageData.cmd = commandsResult && commandsResult.length > 0 ? commandsResult : null;
        } else {
            runImageData.cmd = null;
        }

        // console.log(runImageData);

        // // Now run docker command
        let container = await dockerController.createContainerFromImage(runImageData, sImage);

        console.log(chalk.grey("\nDone"));
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
        console.log("");

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
        let data = await dockerController.inspectContainer(bashContainer);

        if (target) {
            if (target == "raw") {
                console.log(JSON.stringify(data, null, 2));
            } else {
                displayInspectData(target, data[target]);
            }
        } else {
            displayInspectData("image", data.image);
            displayInspectData("network", data.network);
            displayInspectData("bindings", data.bindings);
            displayInspectData("volumes", data.volumes);
        }
    },
    /**
     * shellInContainer
     */
    shellInContainer: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up);
        if (containers.length == 0) {
            console.log(chalk.grey("There are no running containers"));
            return;
        }

        displayAvailableContainers(containers, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container number to start a shell session in:',
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

        let ci = dockerController.getContainerInstance(bashContainer);

        await dockerController.execShellInContainer(ci);
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
        console.log("");

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
        }, {
            type: 'confirm',
            name: 'tail',
            message: 'Tail logs:',
            default: true
        }];

        let qData = await prompt(questions);
        let bashContainer = containers[parseInt(qData.index) - 1];
        await dockerController.containerLogs(bashContainer, qData);
    },


    /**
     * copyFileToContainer
     */
    copyFileToContainer: async() => {
        let containers = await dockerController.listContainers();
        containers = containers.filter(c => c.up);

        displayAvailableContainers(containers, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container to copy a file into:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }, {
            type: 'input',
            name: 'folder',
            message: 'Enter local folder path that contains the files to copy into the container:',
            validate: (path) => {
                if (path.trim().length == 0) {
                    return "Required";
                } else if (!fs.existsSync(path)) {
                    return "Invalide path";
                } else {
                    if (fs.statSync(path).isDirectory()) {
                        return true;
                    } else {
                        return "Source file needs to be a directory";
                    }
                }
            }
        }, {
            type: 'input',
            name: 'destination',
            message: 'Enter container target directory path:',
            validate: (path) => {
                if (path.trim().length == 0) {
                    return "Required";
                }
                return true;
            }
        }];

        let containerData = await prompt(questions);

        let container = containers[parseInt(containerData.index) - 1];
        await dockerController.copyFileToContainer(container, containerData.folder, containerData.destination);
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
        console.log("");

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
        }];

        let containerData = await prompt(questions);

        // ************ PROMPT: Extra command ************
        let commandsResult = await promptForRepetingValue({
            "intro": "Execute commands",
            "value": "Command"
        });

        if (commandsResult.length > 0) {
            let container = containers[parseInt(containerData.index) - 1];
            await dockerController.execInContainer(container, commandsResult);
            console.log(chalk.grey("Done"));
        }
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
        console.log("");

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

        let portResult = await promptForRepetingKeyValues({
            "intro": "Port mapping",
            "key": "Container port",
            "value": "Details"
        }, previousConfig.config.ports ? previousConfig.config.ports : {}, " => ", false);

        let volumeResult = await promptForRepetingKeyValues({
            "intro": "Volume mapping",
            "key": "Container volume path",
            "value": "Details"
        }, previousConfig.config.volumes ? previousConfig.config.volumes : {}, " => ", false, true);

        let envResult = await promptForRepetingKeyValues({
            "intro": "Environement variables",
            "key": "Variable name",
            "value": "Description"
        }, previousConfig.config.env ? previousConfig.config.env : {}, " => ", false);

        previousConfig.config.ports = portResult;
        previousConfig.config.volumes = volumeResult;
        previousConfig.config.env = envResult;

        await dataController.saveImageConfig(sImage, previousConfig.config);

        console.log("\n" + chalk.grey("Done"));
    },
    /**
     * networks
     */
    networks: async() => {
        let networks = await dockerController.listNetworks();
        if (networks.length == 0) {
            console.log(chalk.grey("No networks found"));
            return;
        }
        displayAvailableNetworks(networks);
    },

    /**
     * createNetwork
     */
    createNetwork: async() => {
        let questions = [{
            type: 'list',
            name: 'driver',
            message: 'Network driver:',
            default: 'bridge',
            choices: ['overlay', 'bridge', 'macvlan', 'host']
        }, {
            type: 'input',
            name: 'name',
            message: 'Network name:'
        }, {
            type: 'input',
            name: 'subnet',
            message: 'Subnet (Optional):'
        }, {
            type: 'input',
            name: 'iprange',
            message: 'IP Range (Optional):'
        }, {
            type: 'input',
            name: 'gateway',
            message: 'Gateway (Optional):'
        }];

        let networkData = await prompt(questions);

        let network = await dockerController.createNetwork(networkData);

        console.log("\n" + chalk.grey("Network created"));
    },
    /**
     * deleteNetwork
     */
    deleteNetwork: async() => {
        // Select network
        let networks = await dockerController.listNetworks();
        if (networks.length == 0) {
            console.log(chalk.grey("No networks found"));
            return;
        }
        displayAvailableNetworks(networks, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Network number to delete:',
            validate: (index) => {
                if (validateIndexResponse(networks, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let networkIndex = await prompt(questions);
        let network = networks[parseInt(networkIndex.index) - 1];

        await dockerController.deleteNetwork(network);

        console.log("\n" + chalk.grey("Network deleted"));
    },
    /**
     * linkToNetwork
     */
    linkToNetwork: async() => {
        // Select container
        let containers = await dockerController.listContainers();
        if (containers.length == 0) {
            console.log(chalk.grey("There are no containers"));
            return;
        }

        // Select network
        let networks = await dockerController.listNetworks();
        if (networks.length == 0) {
            console.log(chalk.grey("No networks found"));
            return;
        }

        displayAvailableContainers(containers, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Container number to link a network to:',
            validate: (index) => {
                if (validateIndexResponse(containers, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let containerIndex = await prompt(questions);
        let container = containers[parseInt(containerIndex.index) - 1];

        displayAvailableNetworks(networks, true);
        console.log("");

        questions = [{
            type: 'input',
            name: 'index',
            message: 'Network number to link this container to:',
            validate: (index) => {
                if (validateIndexResponse(networks, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let networkIndex = await prompt(questions);
        let network = networks[parseInt(networkIndex.index) - 1];

        await dockerController.linkToNetwork(container, network);

        console.log("\n" + chalk.grey("Done"));
    },
    /**
     * unlinkFromNetwork
     */
    unlinkFromNetwork: async() => {
        // Select network
        let networks = await dockerController.listNetworks();
        if (networks.length == 0) {
            console.log(chalk.grey("No networks found"));
            return;
        }
        displayAvailableNetworks(networks, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Network number to unlink a container from:',
            validate: (index) => {
                if (validateIndexResponse(networks, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let networkIndex = await prompt(questions);
        let network = networks[parseInt(networkIndex.index) - 1];

        network = await dockerController.inspectNetwork(network);

        questions = [{
            type: 'list',
            name: 'containerName',
            message: 'Unlink container name:',
            choices: []
        }];

        for (let cId in network.Containers) {
            questions[0].choices.push(network.Containers[cId].Name);
        }
        if (questions[0].choices.length == 0) {
            console.log(chalk.grey("No containers to unlink for this network"));
            return;
        }
        let containerNameChoice = await prompt(questions);
        let container = null;
        for (let cId in network.Containers) {
            if (containerNameChoice.containerName == network.Containers[cId].Name) {
                await dockerController.unlinkFromNetwork(cId, network);
            }
        }

        console.log("\n" + chalk.grey("Done"));
    },
    /**
     * inspectNetwork
     */
    inspectNetwork: async() => {
        // Select network
        let networks = await dockerController.listNetworks();
        networks = networks.filter(n => n.Driver != "null");
        if (networks.length == 0) {
            console.log(chalk.grey("No networks found"));
            return;
        }
        displayAvailableNetworks(networks, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'Network number to inspect:',
            validate: (index) => {
                if (validateIndexResponse(networks, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let networkIndex = await prompt(questions);
        let network = networks[parseInt(networkIndex.index) - 1];

        let networkData = await dockerController.inspectNetwork(network);

        console.log("SCOPE: " + chalk.cyan(networkData.Scope));
        console.log("DRIVER: " + chalk.cyan(networkData.Driver));
        networkData.IPAM.Config.forEach(nc => {
            console.log("IMAP CONFIG: Subnet => " + chalk.cyan(nc.Subnet) + ", Gateway => " + chalk.cyan(nc.Gateway));
        });

        let containerNames = [];

        for (let cId in networkData.Containers) {
            containerNames.push(networkData.Containers[cId].Name + " (" + networkData.Containers[cId].IPv4Address + ")");
        }
        console.log("CONTAINERS: " + chalk.cyan(containerNames.length > 0 ? containerNames.join(", ") : "none"));
    },
    /**
     * addRemote
     */
    addRemote: async() => {
        let questions = [{
            type: 'input',
            name: 'name',
            message: 'Remote connection name:',
            validate: (data) => {
                if (data.trim().length == 0) {
                    return "Required";
                } else if (data.match(specialCharactersRegex) == null) {
                    return "No special characters allowed";
                } else {
                    return true;
                }
            }
        }, {
            type: 'list',
            name: 'protocol',
            message: 'Protocol:',
            choices: ['http', 'https'],
            default: 'http'
        }, {
            type: 'input',
            name: 'host',
            message: 'Server host:',
            validate: (data) => {
                return data.trim().length == 0 ? "Required" : true;
            }
        }, {
            type: 'input',
            name: 'port',
            message: 'Server port:',
            validate: (data) => {
                return data.trim().length == 0 ? "Required" : true;
            }
        }];

        let remoteSettings = await prompt(questions);

        if (remoteSettings.protocol == 'https') {
            questions = [{
                type: 'input',
                name: 'ca',
                message: 'ca pem path:',
                validate: (path) => {
                    if (path.trim().length == 0) {
                        return "Required";
                    } else {
                        return true;
                    }
                }
            }, {
                type: 'input',
                name: 'cert',
                message: 'cert pem path:',
                validate: (path) => {
                    if (path.trim().length == 0) {
                        return "Required";
                    } else {
                        return true;
                    }
                }
            }, {
                type: 'input',
                name: 'key',
                message: 'key pem path:',
                validate: (path) => {
                    if (path.trim().length == 0) {
                        return "Required";
                    } else {
                        return true;
                    }
                }
            }]
            let remoteHttpsSettings = await prompt(questions);

            remoteSettings = Object.assign(remoteSettings, remoteHttpsSettings);
        }

        let name = remoteSettings.name;
        delete remoteSettings.name;

        await dataController.saveRemoteServer(name, remoteSettings);
    },
    /**
     * listRemoteConnections
     */
    listRemoteConnections: async() => {
        let remoteConfigs = await dataController.getRemoteServers();
        if (remoteConfigs.length == 0) {
            console.log(chalk.grey("No remote servers found"));
            return;
        }

        displayRemoteConfigs(remoteConfigs);
    },
    /**
     * removeRemote
     */
    removeRemote: async() => {
        let remotes = await dataController.getRemoteServers();
        if (remotes.length == 0) {
            console.log(chalk.grey("No remote servers found"));
            return;
        }
        displayRemoteConfigs(remotes, true);
        console.log("");

        let questions = [{
            type: 'input',
            name: 'index',
            message: 'remote server to remove:',
            validate: (index) => {
                if (validateIndexResponse(remotes, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }];

        let remoteIndexResponse = await prompt(questions);

        let remoteServer = remotes[parseInt(remoteIndexResponse.index) - 1];

        await dataController.removeRemoteServer(remoteServer);
    }
};

/**
 * promptForRepetingKeyValues
 * @param {*} labels 
 * @param {*} existingList 
 */
let promptForRepetingKeyValues = async(labels, existingList, separator, invert, valueIsOptional) => {
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
                        (currentList[e].length > 0 ? (
                            chalk.cyan(
                                (labels.valueShort ? labels.valueShort : "") +
                                currentList[e] +
                                (labels.valuePostShort ? labels.valuePostShort : "")
                            )) : "") +
                        (separator ? separator : "=") +
                        chalk.cyan(
                            (labels.keyShort ? labels.keyShort : "") +
                            e +
                            (labels.keyPostShort ? labels.keyPostShort : "")
                        )
                    );
                } else {
                    console.log(
                        chalk.cyan(
                            (labels.keyShort ? labels.keyShort : "") +
                            e +
                            (labels.keyPostShort ? labels.keyPostShort : "")
                        ) +
                        (currentList[e].length > 0 ? (
                            (separator ? separator : "=") +
                            chalk.cyan(
                                (labels.valueShort ? labels.valueShort : "") +
                                currentList[e] +
                                (labels.valuePostShort ? labels.valuePostShort : "")
                            )
                        ) : "")
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
                                return valueIsOptional || (res.trim().length == 0 ? "Mandatory field" : true)
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
 * promptForRepetingValue
 * @param {*} labels 
 * @param {*} existingList 
 */
let promptForRepetingValue = async(labels, existingList) => {
    return new Promise((resolve, reject) => {
        console.log("");
        console.log(chalk.yellow(labels.intro + ":"));
        let currentList = !existingList ? [] : existingList.map(o => o);
        currentList = currentList.filter(o => o != null);

        const iterate = () => {
            let i = 1;
            console.log("");

            if (currentList.length == 0) {
                console.log(chalk.grey("  -None-"));
            }

            currentList.forEach((e) => {
                console.log(chalk.cyan(e));
            });

            (async() => {
                let noDel = currentList.length == 0;

                console.log("");
                let choice = await askAddDelDone("What do you wish to do", noDel);

                if (choice) {
                    if (choice == "add") {
                        let questions = [{
                            type: 'input',
                            name: 'value',
                            message: labels.value,
                            validate: (res) => {
                                return res.trim().length == 0 ? "Mandatory field" : true
                            }
                        }];

                        // Prompt user with questions
                        let addDetails = await prompt(questions);
                        currentList.push(addDetails.value);
                        iterate();
                    } else if (choice == "remove") {
                        let questions = [{
                            type: 'list',
                            name: 'delValue',
                            message: 'Remove:',
                            choices: []
                        }];

                        currentList.forEach((e) => {
                            questions[0].choices.push(e);
                        });
                        let delItem = await prompt(questions);

                        // delItem.delValue
                        currentList.forEach((e, i) => {
                            if (e == delItem.delValue) {
                                currentList.splice(i, 1);
                            }
                        });

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
 * askAddDelDone
 * @param {*} questionText 
 * @param {*} noDel 
 */
let askAddDelDone = (questionText, noDel) => {
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
                choices: ['Add', 'Remove', 'Done'],
                default: 'Done'
            }];
        }
        (async() => {
            let response = await prompt(questions);

            if (response && response.uchoice == "Add") {
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
            chalk.grey(" - ID " + image["image id"].substring(0, 19) + "..." + ", SIZE " + image["size"])
        );
    });
}

/**
 * displayRemoteConfigs
 * @param {*} remoteList 
 * @param {*} numbered 
 */
let displayRemoteConfigs = (remoteList, numbered) => {
    remoteList.forEach((r, i) => {
        console.log(
            (numbered ? ((i + 1) + ": ") : "") +
            chalk.redBright(r.name) +
            chalk.yellow(" (" + r.settings.protocol + "://" + r.settings.host + ":" + r.settings.port + ")")
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
        let line = chalk.redBright(container["names"]) + " - ID " + container["container id"].substring(0, 12) + "..., created " + new Date(container["created"] * 1000);
        if (container["up"]) {
            line = chalk.green(padContainerStatus(container.state, numbered ? i : null) + line);
        } else {
            line = chalk.grey(padContainerStatus(container.state, numbered ? i : null) + line);
        }
        console.log(
            (numbered ? ((i + 1) + ": ") : "") +
            line
        );
        if (container.image) {
            console.log(
                (numbered ? i > 8 ? "   " : "   " : "") +
                "          (IMAGE ID " +
                (container.image ? container.image["image id"].substring(0, 19) + "..." : "?") +
                " -> " +
                (container.image ? chalk.yellow(container.image.repository + ":" + container.image.tag) : "n/a") +
                ")"
            );
        }
    });
}

/**
 * padContainerStatus
 * @param {*} label 
 */
let padContainerStatus = (label, i) => {
    let totalWidth = 10;
    if (i != null) {
        totalWidth = i > 8 ? 9 : 10;
    }
    let la = label.split("");
    let colon = false;
    for (let i = label.length; i < totalWidth; i++) {
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
 * displayAvailableImages
 * @param {*} images 
 * @param {*} numbered 
 */
let displayAvailableNetworks = (networks, numbered) => {
    networks.forEach((n, i) => {
        console.log(
            (numbered ? ((i + 1) + ": ") : "") + chalk.magenta(n.Name) + ", Scope: " + chalk.yellow(n.Scope) + ", Driver: " + chalk.yellow(n.Driver != "null" ? n.Driver : "n/a")
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
        if (data && data.length > 0) {
            data = data.map(d => d.split(":"));
            data.forEach(d => {
                console.log("BINDING: " + chalk.cyan(d[1]) + " => Host folder " + chalk.cyan(d[0]));
            });
        } else {
            console.log("BINDINGS: none");
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
 * 
 */
let promptRepoAuth = async(selectLocal) => {
    let questions = [];

    let localImage = null;
    if (selectLocal) {
        let images = await dockerController.listImages();
        if (images.length == 0) {
            console.log(chalk.grey("No images found"));
            return;
        }
        displayAvailableImages(images, true);
        console.log("");

        let imgAnswer = await prompt([{
            type: 'input',
            name: 'index',
            message: 'Select image:',
            validate: (index) => {
                if (validateIndexResponse(images, index)) {
                    return true;
                } else {
                    return "Invalide index";
                }
            }
        }]);
        localImage = images[parseInt(imgAnswer.index) - 1];
    } else {
        questions.push({
            type: 'input',
            name: 'imageName',
            message: 'Image / repo name (append tag if not latest):',
            validate: (data) => {
                if (data.trim().length == 0) {
                    return "Required";
                } else {
                    return true;
                }
            }
        });
    }

    let answer = await prompt([{
        type: 'list',
        name: 'privateRepo',
        message: "Are you using a private repo?",
        choices: ['Yes', 'No'],
        default: 'No'
    }]);

    if (answer.privateRepo == "Yes") {
        questions.push({
            type: 'input',
            name: 'username',
            message: 'User name:',
            validate: (data) => {
                if (data.trim().length == 0) {
                    return "Required";
                } else {
                    return true;
                }
            }
        });

        questions.push({
            type: 'input',
            name: 'password',
            message: 'Password:',
            validate: (data) => {
                if (data.trim().length == 0) {
                    return "Required";
                } else {
                    return true;
                }
            }
        });
    }

    let repoAnswers = await prompt(questions);

    let params = {};
    if (answer.privateRepo == "Yes") {
        let registry = null;
        if (!localImage) {
            let registrySplitIndex = repoAnswers.imageName.lastIndexOf("/");
            if (registrySplitIndex != -1) {
                registry = repoAnswers.imageName.substring(0, registrySplitIndex);
                params.serveraddress = "https://" + registry + "/v2";
            }
        }

        params.username = repoAnswers.username;
        params.password = repoAnswers.password;
        params.auth = '';
    }

    if (localImage) {
        return {
            "auth": params,
            "localImage": localImage
        }
    } else {
        return {
            "image": repoAnswers.imageName,
            "auth": params
        }
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