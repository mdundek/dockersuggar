const dataController = require('../controllers/dataController');
const dockerController = require('../controllers/dockerController');
const fs = require("fs");
const path = require("path");
const testDockerfileFolder = "./testDockerImages";

/**
 * Init DB and create test Dockerfile folder
 */
beforeAll(async(done) => {
    if (!fs.existsSync(testDockerfileFolder)) {
        fs.mkdirSync(testDockerfileFolder);
    }
    await dataController.init();
    dataController.setBaseImagesPath(testDockerfileFolder);
    done();
});

/**
 * Remove all test artefacts
 */
afterAll(async(done) => {
    if (fs.existsSync(testDockerfileFolder)) {
        var deleteFolderRecursive = function(_path) {
            if (fs.existsSync(_path)) {
                fs.readdirSync(_path).forEach(function(file, index) {
                    var curPath = _path + "/" + file;
                    if (fs.lstatSync(curPath).isDirectory()) { // recurse
                        deleteFolderRecursive(curPath);
                    } else { // delete file
                        fs.unlinkSync(curPath);
                    }
                });
                fs.rmdirSync(_path);
            }
        };
        deleteFolderRecursive(testDockerfileFolder);
    }
    await dataController.destroyTestDb();
    done();
});

/**
 * Settings DB tests
 */
describe("Docker Controller", async() => {
    it('Create a new Dockerfile', async() => {
        let imgPath = path.join(testDockerfileFolder, "1.0.0");
        fs.mkdirSync(imgPath);
        imgPath = path.join(imgPath, "FooImage");
        fs.mkdirSync(imgPath);
        await dockerController.createDockerfile(imgPath, {
            "baseimage": "scratch",
            "expose": "8080:8080"
        });
        expect(fs.existsSync(path.join(imgPath, "Dockerfile"))).toBe(true);
        expect(fs.existsSync(path.join(imgPath, "docker-entrypoint.sh"))).toBe(true);

        expect(fs.readFileSync(path.join(imgPath, "Dockerfile"), "utf8").split("\n")).toEqual([
            "FROM scratch",
            "",
            "COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh",
            "RUN chmod +x /usr/local/bin/docker-entrypoint.sh",
            "EXPOSE 8080:8080",
            'ENTRYPOINT ["docker-entrypoint.sh"]'
        ]);

        expect(fs.readFileSync(path.join(imgPath, "docker-entrypoint.sh"), "utf8").split("\n")).toEqual([
            "#!/bin/bash",
            "",
            "# Container start script here"
        ]);
    });
});