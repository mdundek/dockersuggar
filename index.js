"use strict"

const promptController = require("./controllers/promptController");
const program = require('commander');
var chalk = require("chalk");
var figlet = require('figlet');

(async() => {
    try {
        await promptController.init();
    } catch (err) {
        console.log(chalk.red("ERROR: "), err.message);
    }

    program
        .version('0.0.7')
        .description("\n" + figlet.textSync('DockerSuggar'));

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
        .description('List docker images')
        .action(() => {
            cmdValue = "images";
            (async() => {
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
    //             console.log("");
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
        .command('bash')
        .description('Bash terminal into running conainer')
        .action(() => {
            cmdValue = "bash";
            (async() => {
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
        .alias('n')
        .description('List available networks')
        .action(() => {
            cmdValue = "networks";
            (async() => {
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

    program.parse(process.argv);

    if (cmdValue === null) {
        console.error('Usage: dockersuggar <command> [options]');
        process.exit(1);
    }
})();