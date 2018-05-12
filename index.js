"use strict"

const promptController = require("./controllers/promptController");
const dockerController = require("./controllers/dockerController");
const dataController = require("./controllers/dataController");
const program = require('./commander-custom/commander');
var chalk = require("chalk");
var figlet = require('figlet');


program
    .version('0.1.2')
    .description("\n" + figlet.textSync('DockerSuggar'))
    .option('-r, --remote <name>', 'Execute command on a remote docker instance');

/**
 * INIT
 * @param {*} p 
 */
let init = async(p) => {
    try {
        await promptController.init();
        await dockerController.init(p.remote);
    } catch (err) {
        console.log(chalk.red("ERROR: "), err.message);
        throw e;
    }
}

let cmdValue = null;

/**
 * COMMANDS: REMOTE STUFF 
 */
program
    .command('listRemotes')
    .section("Docker remote API servers:")
    .description('List remote connections')
    .action(() => {
        cmdValue = "listRemotes";
        (async() => {
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
                await promptController.removeRemote();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

/**
 * COMMANDS: LOCAL DOCKERFILE STUFF 
 */
program
    .command('dockerProjectsBasePath')
    .section("Local Dockerfile stuff:")
    .description('Set / update the base folder path for your Dockerfile projects')
    .action(() => {
        cmdValue = "dockerProjectsBasePath";
        (async() => {
            try {
                await promptController.updateSettings("dockerimgbasepath");
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('dockerfiles')
    .alias('df')
    .description('List local Dockerfiles')
    .action(() => {
        cmdValue = "dockerfiles";
        (async() => {
            try {
                await init(program);
                console.log("");

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
            try {
                await init(program);

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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
                await promptController.build();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

/**
 * COMMANDS: IMAGES RELATED
 */
program
    .command('images')
    .section("Docker images:")
    .alias('i')
    .description('List available docker images')
    .action((options) => {
        cmdValue = "images";
        (async() => {
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
                await promptController.tag();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('pull')
    .description('Pull a docker image from a registry')
    .action(() => {
        cmdValue = "pull";
        (async() => {
            try {
                await init(program);
                console.log("");
                await promptController.pull();
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
// try {
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
            try {
                await init(program);
                console.log("");
                await promptController.deleteImage();
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
    .section("Containers:")
    .alias('c')
    .description('List containers')
    .action(() => {
        cmdValue = "containers";
        (async() => {
            try {
                await init(program);
                console.log("");
                await promptController.containers();
                console.log("");
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('create')
    .description('Create a container from image')
    .action(() => {
        cmdValue = "create";
        (async() => {
            try {
                await init(program);
                console.log("");
                await promptController.create();
                process.exit(0);
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
            try {
                await init(program);
                console.log("");
                await promptController.run();
                process.exit(0);
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
                await promptController.stop();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('pauseContainer')
    .alias('pause')
    .description('Pause running docker container')
    .action(() => {
        cmdValue = "pauseContainer";
        (async() => {
            try {
                await init(program);
                console.log("");
                await promptController.pause();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program
    .command('unpauseContainer')
    .alias('unpause')
    .description('Unpause running docker container')
    .action(() => {
        cmdValue = "unpauseContainer";
        (async() => {
            try {
                await init(program);
                console.log("");
                await promptController.unpause();
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
            try {
                await init(program);
                console.log("");
                await promptController.deleteContainer();
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });


let inspectParameters = ["network", "image", "bindings", "volumes", "raw"];
program
    .command('inspect')
    .description('Get container specific information')
    .option('-t, --target [' + inspectParameters.join("|") + ']', 'Inspect target (raw will show the raw json response)')
    .action((args) => {
        let target = null;
        if (args.target) {
            if (inspectParameters.indexOf(args.target.toLowerCase()) == -1) {
                console.log(chalk.red("Invalide inspect target: "), target);
                return;
            }
            target = args.target.toLowerCase();
        }

        cmdValue = "inspect";
        (async() => {
            try {
                await init(program);
                console.log("");
                await promptController.inspectContainer(target);
            } catch (e) {
                console.log("");
                console.log(e.message);
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
                await promptController.execInContainer();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

/**
 * COMMANDS: NETWORKS 
 */
program
    .command('networks')
    .section("Networks:")
    .alias('net')
    .description('List available networks')
    .action(() => {
        cmdValue = "networks";
        (async() => {
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
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
            try {
                await init(program);
                console.log("");
                await promptController.unlinkFromNetwork();
                process.exit(0);
            } catch (e) {
                console.log("");
                console.log(e.message);
            }
        })();
    });

program.parse(process.argv);

// If no command identified
if (cmdValue === null) {
    console.error('Usage: dockersuggar <command> [options]');
    console.error('Help:  dockersuggar -h');
    process.exit(1);
}