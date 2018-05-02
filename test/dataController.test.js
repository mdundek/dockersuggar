const dataController = require('../controllers/dataController');
const fs = require("fs");
const path = require("path");
const testDockerfileFolder = "./testDockerImages";

/**
 * Init DB and create test Dockerfile folder
 */
beforeAll(async(done) => {
    await dataController.init();
    done();
});

/**
 * Remove all test artefacts
 */
afterAll(async(done) => {
    await dataController.destroyTestDb();
    done();
});

/**
 * Settings DB tests
 */
describe("Settings DB", async() => {
    it('Loads Settings for tests, should be null the first time', async() => {
        let settings = await dataController.getSettings();
        expect(settings).toBe(null);
    });

    let settingsDbId = null;
    it('Set initial Settings object with Dockerfile base folder', async() => {
        let settings = await dataController.saveSettings({
            "dockerimgbasepath": path.join(testDockerfileFolder, "foo")
        });
        expect(settings).not.toBe(null);
        expect(settings._id).not.toBe(undefined);

        settings = await dataController.getSettings();
        expect(settings.dockerimgbasepath).toBe(path.join(testDockerfileFolder, "foo"));

        settingsDbId = settings._id;
    });

    it('Update Settings Dockerfile base folder', async() => {
        let settings = await dataController.saveSettings({
            "dockerimgbasepath": testDockerfileFolder
        });

        expect(settings).not.toBe(null);
        expect(settings._id).not.toBe(undefined);

        settings = await dataController.getSettings();
        expect(settings.dockerimgbasepath).toBe(testDockerfileFolder);

        expect(settings._id).toBe(settingsDbId);
    });
});