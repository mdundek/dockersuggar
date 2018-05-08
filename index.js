"use strict"

const promptController = require("./controllers/promptController");
const dockerController = require("./controllers/dockerController");
const program = require('commander');
var chalk = require("chalk");
var figlet = require('figlet');


program
    .version('0.0.8')
    .description("\n" + figlet.textSync('DockerSuggar'))
    .option('-r, --remote <name>', 'Execute command on a remote docker instance');

/**
 * init
 * @param {*} p 
 */
let init = async(p) => {
    try {
        await promptController.init();
        await dockerController.init(p.remote);
    } catch (err) {
        console.log(chalk.red("ERROR: "), err.message);
    }
}

let cmdValue = null;

/**
 * DOCKERFILE RELATED
 */
program
    .command('dockerfiles')
    .alias('df')
    .description('List local Dockerfiles')
    .action(() => {
        cmdValue = "dockerfiles";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.dockerfiles();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
            console.log("");
        })();
    });

program
    .command('new')
    .alias('n')
    .description('Create a new Dockerfile')
    .action(() => {
        cmdValue = "new";
        (async() => {
            await init(program);
            try {
                await promptController.new();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('editDockerfile')
    .alias('ed')
    .description('Edit dockerfile with default editor')
    .action(() => {
        cmdValue = "editDockerfile";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.openDockerfile();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('build')
    .alias('b')
    .description('Build a docker image')
    .action(() => {
        cmdValue = "build";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.build();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

/**
 * IMAGES RELATED
 */
program
    .command('images')
    .alias('i')
    .description('List available docker images')
    .action((options) => {
        cmdValue = "images";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.images();
                console.log("");
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('document')
    .description('Document an image such as ports, volumes and environement variables')
    .action(() => {
        cmdValue = "describe";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.commentImage();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('tag')
    .alias('t')
    .description('Tag a docker image for a repository')
    .action(() => {
        cmdValue = "tag";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.tag();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

// program
//     .command('push')
//     .alias('p')
//     .description('Push a docker image to repository')
//     .action(() => {
//         cmdValue = "push";
//         (async() => {
// await init(program);
// console.log("");
//             try {
//                 await promptController.push();
//             } catch (e) {
//                 console.log("");
//                 console.log(e.message);
//             }
//         })();
//     });

program
    .command('deleteImage')
    .alias('di')
    .description('Delete a docker image')
    .action(() => {
        cmdValue = "deleteImage";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.deleteImage();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('run')
    .alias('r')
    .description('Run container from image')
    .action(() => {
        cmdValue = "run";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.run();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

/**
 * CONTAINER RELATED
 */
program
    .command('containers')
    .alias('c')
    .description('List containers')
    .action(() => {
        cmdValue = "containers";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.containers();
                console.log("");
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('startContainer')
    .alias('startc')
    .description('Start a docker container')
    .action(() => {
        cmdValue = "startContainer";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.start();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('stopContainer')
    .alias('stopc')
    .description('Stop running docker container')
    .action(() => {
        cmdValue = "stopContainer";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.stop();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('deleteContainer')
    .alias('dc')
    .description('Delete a docker container')
    .action(() => {
        cmdValue = "deleteContainer";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.deleteContainer();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });


let inspectParameters = ["network", "image", "bindings", "volumes", "raw"];
program
    .command('inspect <' + inspectParameters.join("|") + '>')
    .description('Get container specific information')
    .action((target) => {
        cmdValue = "inspect";
        (async() => {
            await init(program);
            target = target.toLowerCase();
            if (inspectParameters.indexOf(target) == -1) {
                console.log(chalk.red("Invalide inspect target: "), target);
            } else {
                console.log("");
                try {
                    await promptController.inspectContainer(target);
                } catch (e) {
                    console.log("");
                    console.log(e.message);
                }
            }
        })();
    });

program
    .command('logs')
    .alias('l')
    .description('Display logs for conainer')
    .action(() => {
        cmdValue = "logs";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.containerLogs();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('shell')
    .description('Shell terminal into running conainer')
    .action(() => {
        cmdValue = "shell";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.shellInContainer();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('exec')
    .alias('e')
    .description('Execute command on running conainer')
    .action(() => {
        cmdValue = "exec";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.execInContainer();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('networks')
    .alias('net')
    .description('List available networks')
    .action(() => {
        cmdValue = "networks";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.networks();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('createNetwork')
    .alias('cn')
    .description('Create new network')
    .action(() => {
        cmdValue = "createNetwork";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.createNetwork();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('deleteNetwork')
    .alias('dn')
    .description('Delete a network')
    .action(() => {
        cmdValue = "deleteNetwork";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.deleteNetwork();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('inspectNetwork')
    .alias('in')
    .description('Inspect a network')
    .action(() => {
        cmdValue = "inspectNetwork";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.inspectNetwork();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('linkToNetwork')
    .alias('ltn')
    .description('Link a container to a network')
    .action(() => {
        cmdValue = "linkToNetwork";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.linkToNetwork();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('unlinkFromNetwork')
    .alias('ufn')
    .description('Unlink a container from a network')
    .action(() => {
        cmdValue = "unlinkFromNetwork";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.unlinkFromNetwork();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('listRemote')
    .description('List remote connections')
    .action(() => {
        cmdValue = "listRemote";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.listRemoteConnections();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('addUpdateRemote')
    .description('Add / Update remote docker connection')
    .action(() => {
        cmdValue = "addRemote";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.addRemote();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('removeRemote')
    .description('Remove a remote docker connection')
    .action(() => {
        cmdValue = "removeRemote";
        (async() => {
            await init(program);
            console.log("");
            try {
                await promptController.removeRemote();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program.parse(process.argv);

if (cmdValue === null) {
    console.error('Usage: dockersuggar <command> [options]');
    process.exit(1);
}