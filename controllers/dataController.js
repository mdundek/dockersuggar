"use strict"

var fs = require("fs");
var path = require("path");

var Datastore = require('nedb');
let db = {
    ImageRunConfigs: new Datastore(path.join('./db', process.env.TEST == 'true' ? 'ImageRunConfigs.test.db' : 'ImageRunConfigs.db')),
    ImageConfigs: new Datastore(path.join('./db', process.env.TEST == 'true' ? 'ImageConfigs.test.db' : 'ImageConfigs.db')),
    Settings: new Datastore(path.join('./db', process.env.TEST == 'true' ? 'Settings.test.db' : 'Settings.db'))
};
db.ImageRunConfigs.loadDatabase();
db.ImageConfigs.loadDatabase();
db.Settings.loadDatabase();

exports.IMAGE_BASE_DIR = "images"; // Will be overwritten by promptController.js anyway

/**
 * init
 */
exports.init = () => {
    return new Promise((resolve, reject) => {
        if (process.env.TEST) {
            setTimeout(() => {
                resolve();
            }, 200);
        } else {
            resolve();
        }
    });
}

/**
 * destroyTestDb: Only used for unit tests
 */
exports.destroyTestDb = () => {
    return new Promise((resolve, reject) => {
        console.log("ATTTEMPT TO DESTROY...");
        fs.unlinkSync(path.join('./db', 'ImageRunConfigs.test.db'));
        fs.unlinkSync(path.join('./db', 'ImageConfigs.test.db'));
        fs.unlinkSync(path.join('./db', 'Settings.test.db'));

        resolve();
    });
}

/**
 * setBaseImagesPath
 * @param {*} fpath 
 */
exports.setBaseImagesPath = (fpath) => {
    this.IMAGE_BASE_DIR = fpath;
};

/**
 * getLocalDokerFiles
 */
exports.getLocalDokerFiles = async() => {
    let dockerFiles = [];
    let folders = await fs.readdirSync(this.IMAGE_BASE_DIR);
    folders = folders.filter(f => fs.lstatSync(path.join(this.IMAGE_BASE_DIR, f)).isDirectory());
    for (let i = 0; i < folders.length; i++) {
        let f = folders[i];
        let p = path.join(this.IMAGE_BASE_DIR, f);

        let tagFolders = await fs.readdirSync(p);
        tagFolders = tagFolders.filter(t => fs.lstatSync(path.join(this.IMAGE_BASE_DIR, f, t)).isDirectory());
        dockerFiles = dockerFiles.concat(tagFolders.map(t => {
            return {
                "repository": f,
                "tag": t,
                "path": path.join(this.IMAGE_BASE_DIR, f, t)
            };
        }));
    }
    return dockerFiles;
};

/**
 * extractExposedPorts
 * @param {*} image 
 */
exports.extractExposedPorts = (image) => {
    let dockerfile = path.join(this.IMAGE_BASE_DIR, image.repository, image.tag, "Dockerfile");
    if (fs.existsSync(dockerfile)) {
        let fileContent = fs.readFileSync(dockerfile, 'utf8');

        let ports = [];
        fileContent.split("\n").forEach(l => {
            if (l.trim().toUpperCase().indexOf("EXPOSE ") == 0) {
                ports = l.trim().substring(7).split(" ");
            }
        });
        return ports;
    } else {
        return null;
    }
};

/**
 * extractVolumes
 * @param {*} image 
 */
exports.extractDockerfileVolumes = (image) => {
    let dockerfile = path.join(this.IMAGE_BASE_DIR, image.repository, image.tag, "Dockerfile");
    if (fs.existsSync(dockerfile)) {
        let fileContent = fs.readFileSync(dockerfile, 'utf8');

        let volumes = [];
        fileContent.split("\n").forEach(l => {
            if (l.trim().toUpperCase().indexOf("VOLUME ") == 0) {
                let _v = l.trim().substring(7);
                if (_v.indexOf("[") == 0) {
                    _v = _v.substring(1, _v.length - 1);
                }
                volumes = _v.split(",");
                if (volumes.length == 1 && _v.indexOf(" ") != -1) {
                    volumes = _v.split(" ");
                }
            }
        });
        return volumes.map(v => v.split("\"").join("").trim());
    } else {
        return null;
    }
};

/**
 * saveImageRunConfig
 * @param {*} image 
 * @param {*} settings 
 */
exports.saveImageRunConfig = async(image, settings) => {
    let existing = await this.lookupImageRunConfig(image);
    if (existing) {
        return new Promise((resolve, reject) => {
            db.ImageRunConfigs.update({
                _id: existing._id
            }, { $set: { "settings": settings } }, {}, (err) => {
                if (err && reject) {
                    reject();
                } else if (!err) {
                    existing = Object.assign(existing, settings);
                    resolve(existing);
                }
            });
        });
    } else {
        var doc = {
            "repository": image.repository,
            "tag": image.tag,
            "settings": settings
        };
        return new Promise((resolve, reject) => {
            db.ImageRunConfigs.insert(doc, (err, newDoc) => {
                if (err && reject) {
                    reject();
                } else if (!err) {
                    resolve(newDoc);
                }
            });
        });
    }
};

/**
 * saveImageRunConfig
 * @param {*} image 
 * @param {*} settings 
 */
exports.saveImageConfig = async(image, config) => {
    let existing = await this.lookupImageConfig(image);
    if (existing) {
        return new Promise((resolve, reject) => {
            db.ImageConfigs.update({
                _id: existing._id
            }, { $set: { "config": config } }, {}, (err) => {
                if (err && reject) {
                    reject();
                } else if (!err) {
                    existing = Object.assign(existing, settings);
                    resolve(newDoc);
                }
            });
        });
    } else {
        var doc = {
            "repository": image.repository,
            "tag": image.tag,
            "config": config
        };
        return new Promise((resolve, reject) => {
            db.ImageConfigs.insert(doc, (err, newDoc) => {
                if (err && reject) {
                    reject();
                } else if (!err) {
                    resolve(newDoc);
                }
            });
        });
    }
};

/**
 * lookupImageRunConfig
 * @param {*} image 
 */
exports.lookupImageRunConfig = async(image) => {
    return new Promise((resolve, reject) => {
        db.ImageRunConfigs.find({
            "repository": image.repository,
            "tag": image.tag
        }, (err, docs) => {
            if (err && reject) {
                reject();
            } else if (!err) {
                resolve(docs.length == 1 ? docs[0] : null);
            }
        });
    });
};

/**
 * getSettings
 */
exports.getSettings = async() => {
    return new Promise((resolve, reject) => {
        db.Settings.find({}, (err, docs) => {
            if (err && reject) {
                reject();
            } else if (!err) {
                resolve(docs.length == 1 ? docs[0] : null);
            }
        });
    });
};

/**
 * saveSettings
 * @param {*} settings 
 */
exports.saveSettings = async(settings) => {
    let existing = await this.getSettings();
    if (existing) {
        return new Promise((resolve, reject) => {
            db.Settings.update({
                _id: existing._id
            }, settings, {}, (err) => {
                if (err && reject) {
                    reject();
                } else if (!err) {
                    existing = Object.assign(existing, settings);
                    this.IMAGE_BASE_DIR = existing.dockerimgbasepath;
                    resolve(existing);
                }
            });
        });
    } else {
        return new Promise((resolve, reject) => {
            db.Settings.insert(settings, (err, newDoc) => {
                if (err && reject) {
                    reject();
                } else if (!err) {
                    this.IMAGE_BASE_DIR = newDoc.dockerimgbasepath;
                    resolve(newDoc);
                }
            });
        });
    }
};

/**
 * lookupImageRunConfig
 * @param {*} image 
 */
exports.lookupImageConfig = async(image) => {
    return new Promise((resolve, reject) => {
        db.ImageConfigs.find({
            "repository": image.repository,
            "tag": image.tag
        }, (err, docs) => {
            if (err && reject) {
                reject();
            } else if (!err) {
                resolve(docs.length == 1 ? docs[0] : null);
            }
        });
    });
};