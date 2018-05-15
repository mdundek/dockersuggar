"use strict"

var Docker = require('dockerode');
var fs = require("fs");
var path = require("path");
var stream = require("stream");
let self = require("./dockerController");
var tar = require('tar');
const dataController = require("./dataController");
const ora = require('ora');

const spinner = ora('');
spinner.color = 'yellow';

let docker = null;

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
exports.init = (remote) => {
    return new Promise((resolve, reject) => {
        var socket;
        // Remote dockerd
        if (remote) {
            dataController.lookupRemoteServer(remote).then((remoteConfig) => {
                if (!remoteConfig) {
                    reject(new Error("Remote server configuration not found"));
                    return;
                }
                let dRemoteCfg = {
                    protocol: remoteConfig.settings.protocol,
                    host: remoteConfig.settings.host,
                    port: remoteConfig.settings.port
                };
                if (remoteConfig.settings.protocol == 'https') {
                    dRemoteCfg.ca = fs.readFileSync(remoteConfig.settings.ca);
                    dRemoteCfg.cert = fs.readFileSync(remoteConfig.settings.cert);
                    dRemoteCfg.key = fs.readFileSync(remoteConfig.settings.key);
                }
                docker = new Docker(dRemoteCfg);
                resolve();
            }).catch((err) => {
                reject(err);
            });
        }
        // Local dockerd
        else {
            socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
            if (!fs.existsSync(socket)) {
                reject(new Error('Are you sure the docker is running?'));
            } else {
                var stats = fs.statSync(socket);
                if (!stats.isSocket()) {
                    reject(new Error('Are you sure the docker is running?'));
                } else {
                    docker = new Docker({ socketPath: socket });
                    resolve();
                }
            }
        }
    });
}

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
 * listImages
 */
exports.listImages = () => {
    return new Promise((resolve, reject) => {
        docker.listImages((err, images) => {
            if (err) {
                reject(err);
            } else {
                let allImages = [];
                images.forEach(function(imageInfo) {
                    allImages = allImages.concat(
                        imageInfo.RepoTags.map(rt => {
                            let repoTagDetails = rt.split(":");
                            return {
                                "repository": repoTagDetails[0],
                                "tag": repoTagDetails[1],
                                "image id": imageInfo.Id,
                                "size": (imageInfo.Size / 1024 / 1024).toFixed(2),
                                "created": imageInfo.Created
                            };
                        })
                    );
                });
                allImages.sort((a, b) => {
                    if (a.repository < b.repository)
                        return -1;
                    if (a.repository > b.repository)
                        return 1;
                    return 0;
                });
                resolve(allImages);
            }
        });
    });
};

/**
 * findImagesByName
 * @param {*} name 
 */
exports.findImagesByName = (name) => {
    let imgDetails = name.split(":");
    return new Promise((resolve, reject) => {
        docker.listImages((err, images) => {
            if (err) {
                reject(err);
            } else {
                let imageArray = [];
                images.forEach(function(imageInfo) {
                    imageInfo.RepoTags.forEach(rt => {
                        let repoTagDetails = rt.split(":");
                        if (imgDetails.length == 1) {
                            if (imgDetails[0] == repoTagDetails[0]) {
                                imageArray.push({
                                    "repository": repoTagDetails[0],
                                    "tag": repoTagDetails[1],
                                    "image id": imageInfo.Id,
                                    "size": (imageInfo.Size / 1024 / 1024).toFixed(2),
                                    "created": imageInfo.Created
                                });
                            }
                        } else if (imgDetails.length == 2) {
                            if (imgDetails[0] == repoTagDetails[0] && imgDetails[1] == repoTagDetails[1]) {
                                imageArray.push({
                                    "repository": repoTagDetails[0],
                                    "tag": repoTagDetails[1],
                                    "image id": imageInfo.Id,
                                    "size": (imageInfo.Size / 1024 / 1024).toFixed(2),
                                    "created": imageInfo.Created
                                });
                            }
                        }
                    })
                });
                resolve(imageArray);
            }
        });
    });
};

/**
 * listNetworks
 */
exports.listNetworks = () => {
    return new Promise((resolve, reject) => {
        docker.listNetworks((err, networks) => {
            if (err) {
                reject(err);
            } else {
                networks.sort((a, b) => {
                    if (a.Name < b.Name)
                        return -1;
                    if (a.Name > b.Name)
                        return 1;
                    return 0;
                });
                resolve(networks);
            }
        });
    });
};

/**
 * listContainers
 */
exports.listContainers = () => {
    return new Promise((resolve, reject) => {
        docker.listContainers({ all: true }, (err, containers) => {
            if (err) {
                reject(err);
            } else {
                (async() => {
                    let images = await self.listImages();
                    containers = containers.map(c => {
                        let cImage = images.find(i => i["image id"] == c.ImageID);
                        if (!cImage) {
                            cImage = images.find(i => (i.repository + ":" + i.tag) == c.Image);
                        }
                        return {
                            "container id": c.Id,
                            "names": c.Names[0],
                            "image": cImage,
                            "up": c.State == "running",
                            "state": c.State,
                            "created": c.Created
                        };
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
                    resolve(containers);
                })();
            }
        });
    });
};

/**
 * deleteImage
 * @param {*} image 
 */
exports.deleteImage = (image) => {
    return new Promise((resolve, reject) => {
        let dImage = docker.getImage(image["image id"]);
        if (dImage) {
            dImage.remove({
                "force": true
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } else {
            reject(new Error("Image not found"));
        }
    });
};

/**
 * deleteContainer
 * @param {*} container 
 */
exports.deleteContainer = (container) => {
    return new Promise((resolve, reject) => {
        let dContainer = docker.getContainer(container["container id"]);
        if (dContainer) {
            dContainer.remove({
                "force": true
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        } else {
            reject(new Error("Container not found"));
        }
    });
};

/**
 * getContainerInstance
 * @param {*} container 
 */
exports.getContainerInstance = (container) => {
    return docker.getContainer(container["container id"]);
};

/**
 * getContainerInstanceById
 * @param {*} containerId 
 */
exports.getContainerInstanceById = (containerId) => {
    return docker.getContainer(containerId);
};

/**
 * containerLogs
 * @param {*} container 
 */
exports.containerLogs = (container, params) => {
    return new Promise((resolve, reject) => {
        params = params ? params : {};
        let dContainer = docker.getContainer(container["container id"]);
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            // create a single stream for stdin and stdout
            var logStream = new stream.PassThrough();

            let doOutput = params.tail ? null : true;
            logStream.on('data', function(chunk) {
                if (doOutput == null && params.tail) {
                    doOutput = false;
                    setTimeout(() => {
                        doOutput = true;
                    }, 1000);
                }
                if (doOutput) {
                    console.log(chunk.toString('utf8').replace(/\n$/, ""));
                }
            });

            let logsParams = {
                stdout: true,
                stderr: true,
                follow: true
            };
            if (!params.tail) {
                logsParams.tail = params.lines ? params.lines : 1000;
            }

            dContainer.logs(logsParams, function(err, stream) {
                if (err) {
                    reject(err);
                    return;
                }
                dContainer.modem.demuxStream(stream, logStream, logStream);
                stream.on('end', function() {
                    logStream.end();
                    resolve();
                });

                if (!params.tail) {
                    setTimeout(function() {
                        stream.destroy();
                    }, 2000);
                }
            });
        }
    });
};

/**
 * inspectContainer
 * @param {*} container 
 * @param {*} target 
 * @param {*} stdIn 
 * @param {*} stdOut 
 */
exports.inspectContainer = (container) => {
    return new Promise((resolve, reject) => {
        let dContainer = container.inspect ? container : docker.getContainer(container["container id"]);
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            // query API for container info
            dContainer.inspect(function(err, inspectData) {
                if (err) {
                    reject(err);
                } else {
                    let network = inspectData.NetworkSettings;
                    network.Hostname = inspectData.Config.Hostname;
                    resolve({
                        "network": network,
                        "image": inspectData.Config.Image,
                        "bindings": inspectData.HostConfig.Binds,
                        "volumes": inspectData.Config.Volumes,
                    });
                }
            });
        }
    });
};

/**
 * execInContainer
 * @param {*} container 
 * @param {*} commands 
 */
exports.execInContainer = (container, commands) => {
    return new Promise((resolve, reject) => {
        (async() => {
            let dContainer = docker.getContainer(container["container id"]);
            if (!dContainer) {
                reject(new Error("Container not found"));
            } else {
                try {
                    await self.execCmdInContainer(dContainer, commands);
                    resolve();
                } catch (err) {
                    reject(err);
                }
            }
        })();
    });
}


/**
 * startContainer
 * @param {*} container 
 */
exports.startContainer = (container) => {
    return new Promise((resolve, reject) => {
        let dContainer = container["container id"] ? docker.getContainer(container["container id"]) : container;
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            dContainer.start(function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
};

/**
 * pauseContainer
 * @param {*} container 
 */
exports.pauseContainer = (container) => {
    return new Promise((resolve, reject) => {
        let dContainer = docker.getContainer(container["container id"]);
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            dContainer.pause(function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
};

/**
 * unpauseContainer
 * @param {*} container 
 */
exports.unpauseContainer = (container) => {
    return new Promise((resolve, reject) => {
        let dContainer = docker.getContainer(container["container id"]);
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            dContainer.unpause(function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
};

/**
 * startContainer
 * @param {*} container 
 */
exports.stopContainer = (container) => {
    return new Promise((resolve, reject) => {
        let dContainer = docker.getContainer(container["container id"]);
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            dContainer.stop(function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
};

/**
 * buildDockerfile
 * @param {*} settings 
 * @param {*} dockerfileData 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.buildDockerfile = (settings, dockerfileData) => {
    return new Promise((resolve, reject) => {
        require('child_process').execFile('tar', ['-cjf', 'Dockerfile.tar', '-C', dockerfileData.path, '.'], (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                let imgPath = "";
                imgPath += hasParam(settings, "registry") ? settings.registry + "/" : "";
                imgPath += (hasParam(settings, "repository") ? settings.repository : dockerfileData.repository) + ":" + dockerfileData.tag;

                var data = fs.createReadStream('./Dockerfile.tar');
                docker.buildImage(data, {
                    rm: true,
                    t: imgPath.toLocaleLowerCase()
                }, (err, stream) => {
                    if (err) {
                        fs.unlinkSync('./Dockerfile.tar');
                        reject(err);
                    } else {
                        stream.on("data", (chunk) => {
                            let lines = chunk.toString('utf8').trim().split("\n");
                            lines.forEach((line) => {
                                let json = JSON.parse(line);
                                if (json.stream) {
                                    console.log(json.stream);
                                } else if (json.aux && json.aux.ID) {
                                    console.log(json.aux.ID);
                                } else if (json.status) {
                                    console.log(json.status + " " + (json.id ? json.id + " " : "") + (json.progress ? ": " + json.progress : ""));
                                }
                            });
                        });

                        stream.on('end', function() {
                            fs.unlinkSync('./Dockerfile.tar');
                            resolve();
                        });
                    }
                });
            }
        });
    });
}

/**
 * tagImage
 * @param {*} settings 
 * @param {*} image 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.tagImage = (image, settings) => {
    return new Promise((resolve, reject) => {
        let dImage = docker.getImage(image["image id"]);
        if (!dImage) {
            reject(new Error("Image not found"));
        } else {
            let repo = "";
            repo += hasParam(settings, "registry") ? settings.registry + "/" : "";
            repo += hasParam(settings, "repository") ? settings.repository : image.repository;

            dImage.tag({
                "repo": repo.toLocaleLowerCase(),
                "tag": settings.tag
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        }
    });
};

/**
 * pushImage
 * @param {*} settings 
 * @param {*} image 
 * @param {*} stdOut 
 * @param {*} stdErr 
 */
exports.pushImage = (image, settings) => {
    return new Promise((resolve, reject) => {
        let dImage = docker.getImage(image["image id"]);
        if (!dImage) {
            reject(new Error("Image not found"));
        } else {
            let opt = {};
            if (settings.auth) {
                opt.authconfig = {
                    username: settings.username,
                    password: settings.password,
                    auth: '',
                    email: settings.email,
                    serveraddress: settings.server
                };
            }

            dImage.push(opt, function(err, stream) {
                if (err) {
                    reject(err);
                } else {
                    stream.pipe(process.stdout);
                    stream.on('end', function() {
                        resolve();
                    });
                }
            });
        }
    });
};

/**
 * pullImage
 * @param {*} settings 
 * @param {*} imageName 
 */
exports.pullImage = (imageName, settings) => {
    return new Promise((resolve, reject) => {
        let opt = {};
        if (settings.auth) {
            opt.authconfig = {
                username: settings.username,
                password: settings.password,
                auth: '',
                email: settings.email,
                serveraddress: settings.server
            };
        }

        if (imageName.indexOf(":") == -1) {
            imageName += ":latest";
        }

        spinner.text = 'Pulling image...';
        spinner.start();

        docker.pull(imageName, (err, stream) => {
            if (err) {
                reject(err);
            } else {
                stream.on("data", (chunk) => {
                    let lines = chunk.toString('utf8').trim().split("\n");
                    lines.forEach((line) => {
                        let json = JSON.parse(line);
                        spinner.text = json.status + (json.progress ? ": " + json.progress : "");
                    });

                });
                stream.on('end', function() {
                    spinner.stop();
                    resolve();
                });
            }
        });
    });
};

/**
 * createNetwork
 * @param {*} params 
 */
exports.createNetwork = (params) => {
    return new Promise((resolve, reject) => {
        docker.createNetwork({
            "Name": params.name,
            "Driver": params.driver // overlay, bridge (default), macvlan
                // "IPAM": {
                //     "Config": [{
                //         "Subnet": "172.20.0.0/16",
                //         "IPRange": "172.20.10.0/24",
                //         "Gateway": "172.20.10.12"
                //     }]
                // }
        }, function(err, network) {
            if (err) {
                reject(err);
            } else {
                resolve(network);
            }
        });
    });
}

/**
 * deleteNetwork
 * @param {*} network 
 */
exports.deleteNetwork = (network) => {
    return new Promise((resolve, reject) => {
        let dNetwork = docker.getNetwork(network.Id);
        dNetwork.remove(function(err, result) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * linkToNetwork
 * @param {*} container 
 * @param {*} network 
 */
exports.linkToNetwork = (container, network) => {
    return new Promise((resolve, reject) => {
        let dNetwork = docker.getNetwork(network.Id);
        dNetwork.connect({
            Container: container['container id']
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * unlinkFromNetwork
 * @param {*} containerId 
 * @param {*} network 
 */
exports.unlinkFromNetwork = (containerId, network) => {
    return new Promise((resolve, reject) => {
        let dNetwork = docker.getNetwork(network.Id);
        dNetwork.disconnect({
            Container: containerId
        }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * getNetworkById
 * @param {*} networkId 
 */
exports.getNetworkById = (networkId) => {
    return docker.getNetwork(networkId);
}

/**
 * inspectNetwork
 * @param {*} network 
 */
exports.inspectNetwork = (network) => {
    return new Promise((resolve, reject) => {
        let dNetwork = docker.getNetwork(network.Id);
        dNetwork.inspect((err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * createContainerFromImage
 * @param {*} params 
 * @param {*} image 
 */
exports.createContainerFromImage = async(params, image) => {
    var optsc = {
        'name': params.name,
        'Image': image.repository + ':' + image.tag,
        'HostConfig': {
            "AutoRemove": params.remove ? true : false,
            'Binds': [],
            "PortBindings": {},
            "Links": []
        }
    };

    optsc.AttachStdin = true;
    optsc.AttachStdout = true;
    optsc.AttachStderr = true;
    optsc.Tty = true;
    optsc.OpenStdin = true;
    optsc.StdinOnce = false;

    if (params.cmd) {
        optsc.Cmd = [];
        params.cmd.map(c => c.split(" ")).forEach(ca => {
            optsc.Cmd = optsc.Cmd.concat(ca);
        });
    }

    populateHostConfig(params, optsc);
    populateEnv(params, optsc);

    let container = await self.createContainer(optsc, params);
    return container;
}

/**
 * run
 * @param {*} params 
 * @param {*} image 
 */
exports.runImage = async(params, image) => {
    var optsc = {
        'name': params.name,
        'Image': image.repository + ':' + image.tag,
        'HostConfig': {
            "AutoRemove": params.remove ? true : false,
            'Binds': [],
            "PortBindings": {},
            "Links": []
        }
    };

    populateHostConfig(params, optsc);
    populateEnv(params, optsc);


    // ************************************************************
    // ********************* CREATE CONTAINER *********************
    // ************************************************************

    optsc.AttachStdin = true;
    optsc.AttachStdout = true;
    optsc.AttachStderr = true;
    optsc.Tty = true;
    optsc.OpenStdin = true;
    optsc.StdinOnce = false;

    // Not detached
    // Shell rather than default cmd
    // No custom cmd
    if (!params.bgMode && params.shell && !params.cmd) {
        optsc.Cmd = ["bin/bash"];
    }
    // Not detached
    // No shell
    // Custom cmd
    else if (!params.bgMode && !params.shell && params.cmd) {
        optsc.Cmd = [];
        params.cmd.map(c => c.split(" ")).forEach(ca => {
            optsc.Cmd = optsc.Cmd.concat(ca);
        });
    }
    // Detached
    // No shell
    // Custom cmd
    else if (params.bgMode && !params.shell && params.cmd) {
        optsc.Cmd = [];
        params.cmd.map(c => c.split(" ")).forEach(ca => {
            optsc.Cmd = optsc.Cmd.concat(ca);
        });
    }

    // Create container
    let container = await self.createContainer(optsc, params);


    // ************************************************************
    // ********************** START CONTAINER *********************
    // ************************************************************

    // Not detached
    // Shell rather than default cmd
    // No custom cmd
    if (!params.bgMode && params.shell && !params.cmd) {
        await self.attachStartAndStdinContainer(container);
        return container;
    }
    // Not detached
    // No shell
    // Custom cmd
    else if (!params.bgMode && !params.shell && params.cmd) {
        await self.attachStartAndStdinContainer(container);
        return container;
    }
    // Not detached
    // No shell
    // No custom cmd
    else if (!params.bgMode && !params.shell && !params.cmd) {
        await self.attachToContainer(container);
        return container;
    }

    // Detached
    // No shell
    // No custom cmd
    else if (params.bgMode && !params.shell && !params.cmd) {
        await self.startContainer(container);
        return container;
    }
    // Detached
    // No shell
    // Custom cmd
    else if (params.bgMode && !params.shell && params.cmd) {
        await self.startContainer(container);
        return container;
    }
}

/**
 * attachToContainer
 * @param {*} container 
 * @param {*} cmd 
 */
exports.attachToContainer = (container) => {
    return new Promise((resolve, reject) => {
        (async() => {
            container.attach({ 'Detach': false, 'Tty': false, stream: true, stdin: false, stdout: true, stderr: true }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                // Show outputs
                stream.pipe(process.stdout);

                stream.on('end', function() {
                    resolve();
                });
            });
        })();
    });
}

/**
 * attachStartAndStdinContainer
 * @param {*} optsc 
 */
exports.attachStartAndStdinContainer = (container) => {
    return new Promise((resolve, reject) => {
        (async() => {

            // Connect stdin
            var isRaw = process.isRaw;

            let exitSuccess = (stream) => {
                process.stdin.removeAllListeners();
                process.stdin.setRawMode(isRaw);
                process.stdin.resume();
                stream.end();
                resolve();
            };

            let exitFail = (stream, err) => {
                process.stdin.removeAllListeners();
                process.stdin.setRawMode(isRaw);
                process.stdin.resume();
                if (stream) {
                    stream.end();
                }
                reject(err);
            };
            container.attach({ 'Detach': false, 'Tty': false, stream: true, stdin: true, stdout: true, stderr: true }, (err, stream) => {
                if (err) {
                    exitFail(stream, err);
                    return;
                }
                var previousKey,
                    CTRL_P = '\u0010',
                    CTRL_Q = '\u0011';

                // Show outputs
                stream.pipe(process.stdout);

                // Connect stdin                
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.setRawMode(true);
                process.stdin.pipe(stream);

                process.stdin.on('data', function(key) {
                    // Detects it is detaching a running container
                    if (previousKey === CTRL_P && key === CTRL_Q) {
                        exitSuccess(stream);
                    }
                    previousKey = key;
                });

                container.start((err, data) => {
                    if (err) {
                        exitFail(stream, err);
                        return;
                    }

                    container.wait(function(err, data) {
                        if (err) {
                            exitFail(stream, err);
                            return;
                        }
                        exitSuccess(stream);
                    });
                });
            });
        })();
    });
}

// /**
//  * attachAndStdinContainer
//  * @param {*} container 
//  */
// exports.attachAndStdinContainer = (container) => {
//     return new Promise((resolve, reject) => {
//         (async() => {

//             // Connect stdin
//             var isRaw = process.isRaw;

//             let exitSuccess = (stream) => {
//                 process.stdin.removeAllListeners();
//                 process.stdin.setRawMode(isRaw);
//                 process.stdin.resume();
//                 stream.end();
//                 resolve();
//             };

//             let exitFail = (stream, err) => {
//                 process.stdin.removeAllListeners();
//                 process.stdin.setRawMode(isRaw);
//                 process.stdin.resume();
//                 if (stream) {
//                     stream.end();
//                 }
//                 reject(err);
//             };

//             container.attach({ 'Detach': false, 'Tty': false, stream: true, stdin: true, stdout: true, stderr: true }, (err, stream) => {
//                 if (err) {
//                     exitFail(stream, err);
//                     return;
//                 }
//                 var previousKey,
//                     CTRL_P = '\u0010',
//                     CTRL_Q = '\u0011';

//                 // Show outputs
//                 stream.pipe(process.stdout);

//                 // Connect stdin                
//                 process.stdin.resume();
//                 process.stdin.setEncoding('utf8');
//                 process.stdin.setRawMode(true);
//                 process.stdin.pipe(stream);

//                 process.stdin.on('data', function(key) {
//                     // Detects it is detaching a running container
//                     if (previousKey === CTRL_P && key === CTRL_Q) {
//                         exitSuccess(stream);
//                     }
//                     previousKey = key;
//                 });

//                 stream.on('close', function() {
//                     exitSuccess(stream);
//                 });
//             });
//         })();
//     });
// }

/**
 * execShellInContainer
 * @param container
 */
exports.execShellInContainer = (container) => {
    return new Promise((resolve, reject) => {

        container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Detach: false,
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
            DetachKeys: "ctrl-p,ctrl-q",
            Cmd: ["bash"]
        }, (error, exec) => {
            if (error) {
                reject(error);
                return;
            }

            var isRaw = process.isRaw;
            let exit = (stream) => {
                process.stdin.removeAllListeners();
                process.stdin.setRawMode(isRaw);
                process.stdin.resume();
                stream.end();
                resolve();
            };

            exec.start({ Detach: false, Tty: true, stream: true, stdin: true, stdout: true, stderr: true, hijack: true }, function(err, stream) {
                if (error) {
                    reject(error);
                    return;
                }

                resizeTty(exec);

                var previousKey,
                    CTRL_P = '\u0010',
                    CTRL_Q = '\u0011';

                stream.setEncoding('utf8');
                stream.pipe(process.stdout);
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.setRawMode(true);
                process.stdin.pipe(stream);

                process.stdin.on('data', function(key) {
                    // Detects it is detaching a running container
                    if (previousKey === CTRL_P && key === CTRL_Q) {
                        exit(stream);
                    }
                    previousKey = key;
                });

                stream.on('close', function() {
                    exit(stream);
                });
            });
        });
    });
}

/**
 * execCmdInContainer
 * @param {*} container 
 * @param {*} cmd 
 */
exports.execCmdInContainer = (container, cmd) => {
    return new Promise((resolve, reject) => {
        let cmdArray = [];
        cmd.forEach(c => {
            cmdArray = cmdArray.concat(c.split(" "));
        });

        container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
            Cmd: cmdArray,
            DetachKeys: "ctrl-p,ctrl-q"
        }, (error, exec) => {
            if (error) {
                reject(error);
                return;
            }

            let exit = (stream, isRaw) => {
                process.stdin.removeAllListeners();
                process.stdin.setRawMode(isRaw);
                process.stdin.resume();
                stream.end();
                resolve();
            };

            var attach_opts = { 'Detach': false, 'Tty': false, stream: true, stdin: true, stdout: true, stderr: true, hijack: true };
            exec.start(attach_opts, function(err, stream) {
                if (error) {
                    reject(error);
                    return;
                }

                resizeTty(exec);

                var previousKey,
                    CTRL_P = '\u0010',
                    CTRL_Q = '\u0011';

                stream.setEncoding('utf8');
                stream.pipe(process.stdout);

                var isRaw = process.isRaw;
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.setRawMode(true);
                process.stdin.pipe(stream);

                process.stdin.on('data', function(key) {
                    // Detects it is detaching a running container
                    if (previousKey === CTRL_P && key === CTRL_Q) {
                        exit(stream, isRaw);
                    }
                    previousKey = key;
                });

                stream.on('close', function() {
                    exit(stream, isRaw);
                });
            });
        });
    });
}

// /**
//  * createAndStartContainer
//  * @param {*} optsc 
//  */
// exports.createAndStartContainer = (optsc, params) => {
//     return new Promise((resolve, reject) => {
//         (async() => {
//             // Create container
//             let container = await self.createContainer(optsc, params);

//             // Start container
//             container.start(function(err, data) {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve(container);
//                 }
//             });
//         })();
//     });
// }

/**
 * createContainer
 * @param {*} optsc 
 */
exports.createContainer = (optsc, params) => {
    return new Promise((resolve, reject) => {
        docker.createContainer(optsc, (err, container) => {
            (async() => {
                if (err) {
                    reject(err);
                } else {
                    if (params.network) {
                        try {
                            await self.linkToNetwork({ "container id": container.id }, { Id: params.networkId });
                        } catch (e) {
                            reject(e);
                            return;
                        }
                    }
                    resolve(container);
                }
            })();
        });
    });
}

/**
 * populateHostConfig
 * @param {*} settings 
 * @param {*} optsc 
 */
let populateHostConfig = (settings, optsc) => {
    if (settings.volumes) {
        for (let vol in settings.volumes) {
            optsc.HostConfig.Binds.push(settings.volumes[vol] + ":" + vol);
        }
    }

    if (settings.ports) {
        if (!optsc.ExposedPorts) {
            optsc.ExposedPorts = {};
        }
        for (let po in settings.ports) {
            optsc.ExposedPorts[po + "/tcp"] = {}
            optsc.HostConfig.PortBindings[po + "/tcp"] = [{ "HostPort": settings.ports[po] }];
        }
    }
}

/**
 * populateEnv
 * @param {*} settings 
 * @param {*} optsc 
 */
let populateEnv = (settings, optsc) => {
    if (settings.env) {
        optsc.Env = [];
        for (let env in settings.env) {
            optsc.Env.push(env + "=" + settings.env[env]);
        }
    }
}

/**
 * resize
 */
let resizeTty = (exec) => {
    var dimensions = {
        h: process.stdout.rows,
        w: process.stderr.columns
    };

    if (dimensions.h != 0 && dimensions.w != 0) {
        try {
            exec.resize(dimensions, (d) => {});
        } catch (e) {}
    }
}