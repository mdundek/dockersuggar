"use strict"

const promptController = require("./controllers/promptController");
const program = require('commander');
var chalk = require("chalk");
var figlet = require('figlet');

(async() => {
    try {
        await promptController.init();

        program
            .version('0.0.2')
            .description("\n" + figlet.textSync('DockerSuggar'))

        let cmdValue = null;

        program
            .command('dockerfiles')
            .alias('df')
            .description('List local Dockerfiles')
            .action(() => {
                cmdValue = "dockerfiles";
                (async() => {
                    console.log("");
                    await promptController.dockerfiles();
                    console.log("");
                })();
            });

        program
            .command('images')
            .alias('i')
            .description('List docker images')
            .action(() => {
                cmdValue = "images";
                (async() => {
                    console.log("");
                    await promptController.images();
                    console.log("");
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
                    await promptController.openDockerfile();
                })();
            });

        program
            .command('containers')
            .alias('c')
            .description('List containers')
            .action(() => {
                cmdValue = "containers";
                (async() => {
                    console.log("");
                    await promptController.containers();
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
                    await promptController.new();
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
                    await promptController.build();
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
                    await promptController.tag();
                })();
            });

        program
            .command('push')
            .alias('p')
            .description('Push a docker image to repository')
            .action(() => {
                cmdValue = "push";
                (async() => {
                    console.log("");
                    await promptController.push();
                })();
            });

        program
            .command('deleteImage')
            .alias('di')
            .description('Delete a docker image')
            .action(() => {
                cmdValue = "deleteImage";
                (async() => {
                    console.log("");
                    await promptController.deleteImage();
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
                    await promptController.deleteContainer();
                })();
            });

        program
            .command('startContaier')
            .alias('startc')
            .description('Start a docker container')
            .action(() => {
                cmdValue = "startContaier";
                (async() => {
                    console.log("");
                    await promptController.start();
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
                    await promptController.run();
                })();
            });

        let inspectParameters = ["network", "image", "bindings", "volumes", "raw"];
        program
            .command('inspect <' + inspectParameters.join("|") + '>')
            .alias('i')
            .description('Get container specific information')
            .action((target) => {
                cmdValue = "inspect";
                (async() => {
                    target = target.toLowerCase();
                    if (inspectParameters.indexOf(target) == -1) {
                        console.log(chalk.red("Invalide inspect target: "), target);
                    } else {
                        console.log("");
                        await promptController.inspectContainer(target);
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
                    await promptController.containerLogs();
                })();
            });

        program
            .command('bash')
            .alias('b')
            .description('Bash terminal into running conainer')
            .action(() => {
                cmdValue = "bash";
                (async() => {
                    console.log("");
                    await promptController.bashInContainer();
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
                    await promptController.execInContainer();
                })();
            });

        program
            .command('comment')
            .description('Comment an image')
            .action(() => {
                cmdValue = "comment";
                (async() => {
                    console.log("");
                    await promptController.commentImage();
                })();
            });


        program.parse(process.argv);

        if (cmdValue === null) {
            console.error('Usage: dockersuggar <command> [options]');
            process.exit(1);
        }
    } catch (err) {
        console.log(chalk.red("ERROR: "), err.message);
    }
})();

/** Manage docker run profiles
 * 
 * Ex. dockersuggar run [profilename] <container name>
 * Add command to save last image/tag settings as run profile
 */

/** Docker tag / push save last used settings 
 * 
 */

/** Dockerfile snippet helper
 * Provide tools to add common snipets to your dockerfile
 * Ex. Add Nodejs, Add GIT, Add Python...
 */