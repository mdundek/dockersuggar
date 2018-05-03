"use strict"

var fs = require("fs");
var path = require("path");

const { spawn, exec } = require("child_process");
var pty = require("pty.js");
var readline = require('readline');

const dockerCLI = require("docker-cli-js");
const DockerOptions = dockerCLI.Options;
const Docker = dockerCLI.Docker;

let docker = null;
let errorCallback = null;

/**
 * hasParam
 * @param {*} o 
 * @param {*} p 
 */
let hasParam = (o, p) => {
    return o[p] != undefined && o[p] != null && o[p].trim().length > 0;
}

/**
 * init
 */
exports.init = (errorCb) => {
    errorCallback = errorCb;
    return new Promise((resolve, reject) => {

        exec("docker ps", (error, stdout, stderr) => {
            if (error) {
                reject(new Error("Docker daemon not found. Make sur you installed and started Docker on this machine."));
            } else {
                docker = new Docker();
                resolve();
            }
        });
    });
}

/**
 * listImages
 */
exports.listImages = async() => {
    try {
        let data = await docker.command("images");
        let images = data.images.filter(i => i.repository != "<none>" && i.tag != "<none>" && (i.repository.length != 12 || i.repository.indexOf(".") != -1 || i.repository.indexOf("/") != -1));
        images.sort((a, b) => {
            if (a.repository < b.repository)
                return -1;
            if (a.repository > b.repository)
                return 1;
            return 0;
        });
        return images;
    } catch (err) {
        errorCallback(err);
    }
};

/**
 * listImages
 */
exports.listContainers = async() => {
    try {
        let data = await docker.command("ps -a");
        let containers = data.containerList;

        let idata = await docker.command("images");
        let images = idata.images;
        // console.log(JSON.stringify(images, null, 4));
        containers = containers.map(c => {
            let cImage = images.find(i => i["image id"] == c.image);
            if (!cImage) {
                cImage = images.find(i => (i.repository + ":" + i.tag) == c.image);
            }
            if (!cImage) {
                cImage = images.find(i => (i.repository) == c.image);
            }
            c.image = cImage;
            c.up = c.status.toLowerCase().indexOf("up ") == 0;
            return c;
        });
        containers.sort((a, b) => {
            if (a.image && b.image) {
                if (a.image.repository < b.image.repository)
                    return -1;
                if (a.image.repository > b.image.repository)
                    return 1;
                return 0;
            } else {
                return 1;
            }
        });
        return containers;
    } catch (err) {
        errorCallback(err);
    }
};

/**
 * deleteImage
 * @param {*} image 
 */
exports.deleteImage = async(image) => {
    try {
        let data = await docker.command("rmi " + image.repository + ":" + image.tag);
    } catch (err) {
        errorCallback(err);
    }
};

/**
 * deleteContainer
 * @param {*} container 
 */
exports.deleteContainer = async(container) => {
    try {
        let data = await docker.command("rm -fv " + container["container id"]);
    } catch (err) {
        errorCallback(err);
    }
};

/**
 * bashContainer
 * @param {*} container 
 */
exports.bashInContainer = async(container) => {
    return this.dockerPtyCommand([
        "exec",
        "-it",
        container.names,
        "bash"
    ]);
};

/**
 * containerLogs
 * @param {*} container 
 */
exports.containerLogs = async(container, stdIn, stdOut) => {
    return this.dockerCommand([
        "logs",
        container['container id']
    ], stdIn, stdOut);
};

/**
 * inspectContainer
 * @param {*} container 
 * @param {*} target 
 * @param {*} stdIn 
 * @param {*} stdOut 
 */
exports.inspectContainer = async(container, target) => {
    let inspectData = await docker.command("inspect " + container["container id"]);
    if (target == "network") {
        let network = inspectData.object[0].NetworkSettings;
        network.Hostname = inspectData.object[0].Config.Hostname;
        return network;
    } else if (target == "image") {
        return inspectData.object[0].Config.Image;
    } else if (target == "bindings") {
        return inspectData.object[0].HostConfig.Binds;
    } else if (target == "volumes") {
        return inspectData.object[0].Config.Volumes;
    } else {
        return inspectData.object[0];
    }
};

/**
 * execInContainer
 * @param {*} container 
 * @param {*} command 
 */
exports.execInContainer = async(container, command) => {
    let params = [
        "exec",
        "-it",
        container.names
    ];
    params = params.concat(command.split(" "));
    return this.dockerPtyCommand(params);
};

/**
 * startContainer
 * @param {*} container 
 */
exports.startContainer = async(container) => {
    try {
        let data = await docker.command("start " + container["container id"]);
    } catch (err) {
        errorCallback(err);
    }
};

/**
 * stopContainer
 * @param {*} container 
 */
exports.stopContainer = async(container) => {
    try {
        let data = await docker.command("stop " + container["container id"]);
    } catch (err) {
        errorCallback(err);
    }
};


/**
 * cleanupImages
 */
exports.cleanupImages = async() => {
    try {
        await docker.command('rmi $(docker images -f "dangling=true" -q)');
    } catch (err) {
        errorCallback(err);
    }
};


/**
 * buildDockerfile
 * @param {*} settings 
 * @param {*} dockerfileData 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.buildDockerfile = async(settings, dockerfileData, stdOut, stdErr) => {
    const params = [
        "build",
        "-t"
    ];

    let imgPath = "";
    imgPath += hasParam(settings, "registry") ? settings.registry + "/" : "";
    imgPath += hasParam(settings, "repository") ? settings.repository + "/" : "";
    imgPath += dockerfileData.repository + ":" + dockerfileData.tag;
    params.push(imgPath);

    params.push(dockerfileData.path);

    return this.dockerCommand(params, stdOut, stdErr);
};

/**
 * tagImage
 * @param {*} settings 
 * @param {*} image 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.tagImage = async(settings, image, stdOut, stdErr) => {
    const params = [
        "tag",
        image.repository + ":" + image.tag
    ];

    let imgPath = "";
    imgPath += hasParam(settings, "registry") ? settings.registry + "/" : "";
    imgPath += hasParam(settings, "repository") ? settings.repository + "/" : "";
    imgPath += image.repository + ":" + image.tag;
    params.push(imgPath);

    return this.dockerCommand(params, stdOut, stdErr);
};

/**
 * pushImage
 * @param {*} settings 
 * @param {*} image 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.pushImage = async(settings, image, stdOut, stdErr) => {
    const params = [
        "push"
    ];

    let imgPath = "";
    imgPath += hasParam(settings, "registry") ? settings.registry + "/" : "";
    imgPath += hasParam(settings, "repository") ? settings.repository + "/" : "";
    imgPath += image.repository + ":" + image.tag;
    params.push(imgPath);

    return this.dockerCommand(params, stdOut, stdErr);
};

/**
 * runImage
 * @param {*} settings 
 * @param {*} image 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.runImage = async(settings, image, stdOut, stdErr) => {
    let params = [
        "run"
    ];

    params.push("-i");

    if (settings.bgMode) {
        params.push("-td");
    } else {
        params.push("-t");
    }

    if (settings.remove) {
        params.push("--rm");
    }

    if (hasParam(settings, "name")) {
        params.push("--name");
        params.push(settings.name);
    }

    if (settings.ports) {
        for (let po in settings.ports) {
            params.push("-p");
            params.push(settings.ports[po] + ":" + po);
        }
    }

    if (settings.env) {
        for (let env in settings.env) {
            params.push("-e");
            params.push(env + "=" + settings.env[env] + "");
        }
    }

    if (settings.volumes) {
        for (let vol in settings.volumes) {
            params.push("-v");
            params.push(settings.volumes[vol] + ":" + vol);
        }
    }

    params.push(image.repository + ":" + image.tag);

    if (settings.shell) {
        params.push(settings.shellType);
    } else if (hasParam(settings, "cmd")) {
        params = params.concat(params, settings.cmd.split(" "));
    }

    if (settings.shell || !settings.bgMode || hasParam(settings, "cmd")) {
        return this.dockerPtyCommand(params, (!settings.shell && !settings.bgMode));
    } else {
        return this.dockerCommand(params, stdOut, stdErr);
    }
};

/**
 * createDockerfile
 * @param {*} dirPath 
 * @param {*} params 
 */
exports.createDockerfile = (dirPath, params) => {
    let Dockerfile = ["FROM " + params.baseimage];
    Dockerfile.push("");
    Dockerfile.push("COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh");
    Dockerfile.push("RUN chmod +x /usr/local/bin/docker-entrypoint.sh");

    if (params.expose.trim().length > 0) {
        Dockerfile.push("EXPOSE " + params.expose);
    }

    Dockerfile.push('ENTRYPOINT ["docker-entrypoint.sh"]');
    fs.writeFileSync(path.join(dirPath, "Dockerfile"), Dockerfile.join("\n"));

    let EntryFile = ["#!/bin/bash"];
    EntryFile.push("");
    EntryFile.push("# Container start script here");
    fs.writeFileSync(path.join(dirPath, "docker-entrypoint.sh"), EntryFile.join("\n"));
};

/**
 * dockerCommand
 * @param {*} params 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.dockerCommand = async(params, stdOut, stdErr) => {
    return new Promise(function(resolve) {
        let exited = false;
        const dockerSpawn = spawn("docker", params);
        dockerSpawn.stdout.on("data", (data) => {
            if (data.toString().trim().length > 0) {
                stdOut(data.toString().replace(/\n$/, ""));
            }
        });
        dockerSpawn.stderr.on("data", (data) => {
            stdErr(data.toString().replace(/\n$/, ""));
        });
        dockerSpawn.on("exit", (code) => {
            if (!exited) {
                exited = true;
                resolve(code);
            }
        });
    });
};

/**
 * dockerPtyCommand
 * @param {*} params 
 */
exports.dockerPtyCommand = async(params, nonInput) => {
    return new Promise(function(resolve) {
        let exited = false;
        var rl = null;
        // If the PTY session requires user input, we initiate a readline session
        if (!nonInput) {
            rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
        }

        var term = pty.spawn("docker", params);

        let userCommand = null;
        let closeInterval = null;
        term.on('data', function(data) {
            let line = data.toString();

            let lines = line.split("\r");
            lines.forEach((l) => {
                if (userCommand && userCommand == l.replace(/\n$/, "")) {
                    userCommand = null;
                } else {
                    process.stdout.write(l);
                }
            });
        });
        term.on('exit', function(code) {
            if (!exited) {
                clearInterval(closeInterval);
                exited = true;
                if (rl) {
                    rl.close();
                }
                resolve(0);
            }
        });

        // If command mode (bashed into container for example)
        if (rl) {
            rl.on('line', function(line) {
                userCommand = line.replace(/\n$/, "");
                if (userCommand.trim().toLowerCase() == "exit") {
                    closeInterval = setInterval(() => {
                        term.write("\r");
                    }, 500);
                }
                term.write(line + '\n');
            });
        }
        // Otherwise we monitor when the container exits to terminate the PTY terminal manually
        else {
            let self = require("./dockerController");
            let cName = params[params.indexOf("--name") + 1];
            closeInterval = setInterval(() => {
                (async() => {
                    self.listContainers().then((containers) => {
                        if (containers.find(c => c.names == cName) == null) {
                            term.write("\r");
                        }
                    });
                })();
            }, 1000);
        }
    });
};