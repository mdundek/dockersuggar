"use strict"

var Docker = require('dockerode');
var fs = require("fs");
var path = require("path");
var stream = require("stream");
let self = require("./dockerController");
var tar = require('tar');

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
exports.init = () => {
    return new Promise((resolve, reject) => {
        var socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
        var stats = fs.statSync(socket);

        if (!stats.isSocket()) {
            reject(new Error('Are you sure the docker is running?'));
        } else {
            docker = new Docker({ socketPath: socket });
            resolve();
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
                                "size": (imageInfo.Size / 1024 / 1024).toFixed(2)
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
exports.inspectContainer = (container, target) => {
    return new Promise((resolve, reject) => {
        let dContainer = container.inspect ? container : docker.getContainer(container["container id"]);
        if (!dContainer) {
            reject(new Error("Container not found"));
        } else {
            // query API for container info
            dContainer.inspect(function(err, inspectData) {
                if (err) {
                    reject(err);
                } else if (target == "network") {
                    let network = inspectData.NetworkSettings;
                    network.Hostname = inspectData.Config.Hostname;
                    resolve(network);
                } else if (target == "image") {
                    resolve(inspectData.Config.Image);
                } else if (target == "bindings") {
                    resolve(inspectData.HostConfig.Binds);
                } else if (target == "volumes") {
                    resolve(inspectData.Config.Volumes);
                } else {
                    resolve(inspectData);
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
        let dContainer = docker.getContainer(container["container id"]);
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
                        stream.pipe(process.stdout, {
                            end: true
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
            console.log(image);
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

    if (params.bgMode || params.shell || (params.cmd && params.cmd.length > 0)) {
        if (params.bgMode) {
            let container = await self.createAndStartContainer(optsc, params);

            if (params.cmd.length == 0 && params.shell) {
                await self.execShellInContainer(container);
            } else if (params.cmd.length > 0 && !params.shell) {
                await self.execCmdInContainer(container, params.cmd);
            }
            return container;
        } else {
            if (params.shell) {
                optsc.Cmd = ["bin/bash"];
            } else {
                optsc.Cmd = params.cmd;
            }

            optsc.AttachStdin = true;
            optsc.AttachStdout = true;
            optsc.AttachStderr = true;
            optsc.Tty = true;
            optsc.OpenStdin = true;
            optsc.StdinOnce = false;

            let container = await self.createAndStartContainer(optsc, params);
            await self.attachAndStdinContainer(container);
            return container;
        }
    } else {
        let container = await self.createAndStartContainer(optsc, params);
        await self.attachToContainer(container);
        return container;
    }
}

/**
 * execCmdInContainer
 * @param {*} container 
 * @param {*} cmd 
 */
exports.attachToContainer = (container) => {
    return new Promise((resolve, reject) => {
        (async() => {
            container.attach({ stream: true, stdin: false, stdout: true, stderr: true }, (err, stream) => {
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
 * attachAndStdinContainer
 * @param {*} optsc 
 */
exports.attachAndStdinContainer = (container) => {
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

            container.attach({ stream: true, stdin: true, stdout: true, stderr: true }, (err, stream) => {
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
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
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

            var attach_opts = { 'Detach': false, 'Tty': false, stream: true, stdin: true, stdout: true, stderr: true, hijack: true };
            exec.start(attach_opts, function(err, stream) {
                if (error) {
                    reject(error);
                    return;
                }

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
        container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
            Cmd: cmd
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

/**
 * createAndStartContainer
 * @param {*} optsc 
 */
exports.createAndStartContainer = (optsc, params) => {
    return new Promise((resolve, reject) => {
        (async() => {
            // Create container
            let container = await self.createContainer(optsc);

            if (params.network) {
                try {
                    await self.linkToNetwork({ "container id": container.id }, { Id: params.networkId });
                } catch (e) {
                    console.log(e);
                    reject(e);
                    return;
                }
            }

            // Start container
            container.start(function(err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(container);
                }
            });
        })();
    });
}

/**
 * createContainer
 * @param {*} optsc 
 */
exports.createContainer = (optsc) => {
    return new Promise((resolve, reject) => {
        docker.createContainer(optsc, (err, container) => {
            if (err) {
                reject(err);
            } else {
                resolve(container);
            }
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
        for (let po in settings.ports) {
            optsc.HostConfig.PortBindings[settings.ports[po] + "/tcp"] = [{ "HostPort": po }];
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