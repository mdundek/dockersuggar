"use strict"

var fs = require("fs");
var fse = require('fs-extra');
var path = require("path");

var Datastore = require('nedb');

// Dockersuggar config base folder
let dsConfigFolder = path.join(require('os').homedir(), '.dockersuggar');
if (!fs.existsSync(dsConfigFolder)) {
    fs.mkdirSync(dsConfigFolder);
}

// NLU model folders
let nluFolder = path.join(dsConfigFolder, 'nlu');
if (!fs.existsSync(nluFolder)) {
    fs.mkdirSync(nluFolder);
}
exports.NLU_DATA_FOLDER = path.join(nluFolder, 'data');
exports.NLU_LOGS_FOLDER = path.join(nluFolder, 'logs');
exports.NLU_PROJECT_FOLDER = path.join(nluFolder, 'projects');
exports.NLU_PROJECT_DOCKERSUGGAR_TS_FOLDER = path.join(this.NLU_PROJECT_FOLDER, 'dockersuggar_tensorflow');
exports.NLU_PROJECT_DOCKERSUGGAR_SP_FOLDER = path.join(this.NLU_PROJECT_FOLDER, 'dockersuggar_spacy');

if (!fs.existsSync(this.NLU_LOGS_FOLDER)) {
    fs.mkdirSync(this.NLU_LOGS_FOLDER);
}
if (!fs.existsSync(this.NLU_PROJECT_FOLDER)) {
    fs.mkdirSync(this.NLU_PROJECT_FOLDER);
}
if (!fs.existsSync(this.NLU_DATA_FOLDER)) {
    fs.mkdirSync(this.NLU_DATA_FOLDER);
}

// Database folder
let dsDbFolder = path.join(dsConfigFolder, 'db');
if (!fs.existsSync(dsDbFolder)) {
    fs.mkdirSync(dsDbFolder);
}

let db = {
    ImageRunConfigs: new Datastore(path.join(dsDbFolder, process.env.TEST == 'true' ? 'ImageRunConfigs.test.db' : 'ImageRunConfigs.db')),
    ImageConfigs: new Datastore(path.join(dsDbFolder, process.env.TEST == 'true' ? 'ImageConfigs.test.db' : 'ImageConfigs.db')),
    Settings: new Datastore(path.join(dsDbFolder, process.env.TEST == 'true' ? 'Settings.test.db' : 'Settings.db')),
    RemoteServers: new Datastore(path.join(dsDbFolder, process.env.TEST == 'true' ? 'RemoteServers.test.db' : 'RemoteServers.db')),
    NlpMissmatches: new Datastore(path.join(dsDbFolder, process.env.TEST == 'true' ? 'NlpMissmatch.test.db' : 'NlpMissmatch.db'))
};
db.ImageRunConfigs.loadDatabase();
db.ImageConfigs.loadDatabase();
db.Settings.loadDatabase();
db.RemoteServers.loadDatabase();
db.NlpMissmatches.loadDatabase();

exports.IMAGE_BASE_DIR = "images"; // Will be overwritten by promptController.js anyway

/**
 * init
 */
exports.init = () => {
    return new Promise((resolve, reject) => {
        try {
            fse.copySync(path.join(__basedir, "resources/rasa_nlu/projects"), this.NLU_PROJECT_FOLDER);
            if (process.env.TEST) {
                setTimeout(() => {
                    resolve();
                }, 200);
            } else {
                resolve();
            }
        } catch (err) {
            reject(err)
        }
    });
}

/**
 * destroyTestDb: Only used for unit tests
 */
exports.destroyTestDb = () => {
    return new Promise((resolve, reject) => {
        fs.unlinkSync(path.join(dsDbFolder, 'ImageRunConfigs.test.db'));
        fs.unlinkSync(path.join(dsDbFolder, 'ImageConfigs.test.db'));
        fs.unlinkSync(path.join(dsDbFolder, 'Settings.test.db'));
        fs.unlinkSync(path.join(dsDbFolder, 'RemoteServers.test.db'));

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
 * deleteModelData
 */
exports.deleteModelData = () => {
    fse.removeSync(this.NLU_PROJECT_DOCKERSUGGAR_TS_FOLDER);
    fse.removeSync(this.NLU_PROJECT_DOCKERSUGGAR_SP_FOLDER);
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
    let settingsEscaped = _escapeFieldNames(JSON.parse(JSON.stringify(settings)));
    let existing = await this.lookupImageRunConfig(image);
    if (existing) {
        return new Promise((resolve, reject) => {
            db.ImageRunConfigs.update({
                _id: existing._id
            }, { $set: { "settings": settingsEscaped } }, {}, (err) => {
                if (err && reject) {
                    reject(err);
                } else if (!err) {
                    existing = Object.assign(_unescapeFieldNames(existing), settings);
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
                    reject(err);
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
exports.saveRemoteServer = async(name, settings) => {
    let existing = await this.lookupRemoteServer(name);
    if (existing) {
        return new Promise((resolve, reject) => {
            db.RemoteServers.update({
                _id: existing._id
            }, { $set: { "settings": settings } }, {}, (err) => {
                if (err && reject) {
                    reject(err);
                } else if (!err) {
                    existing.settings = Object.assign(existing.settings, settings);
                    resolve();
                }
            });
        });
    } else {
        var doc = {
            "name": name,
            "settings": settings
        };
        return new Promise((resolve, reject) => {
            db.RemoteServers.insert(doc, (err, newDoc) => {
                if (err && reject) {
                    reject(err);
                } else if (!err) {
                    resolve();
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
                    reject(err);
                } else if (!err) {
                    existing.config = Object.assign(existing.config, config);
                    resolve(existing);
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
                    reject(err);
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
                reject(err);
            } else if (!err) {
                resolve(docs.length == 1 ? _unescapeFieldNames(docs[0]) : null);
            }
        });
    });
};

/**
 * 
 * @param {*} name 
 */
exports.lookupRemoteServer = async(name) => {
    return new Promise((resolve, reject) => {
        db.RemoteServers.find({
            "name": name
        }, (err, docs) => {
            if (err && reject) {
                reject(err);
            } else if (!err) {
                resolve(docs.length == 1 ? docs[0] : null);
            }
        });
    });
};

/**
 * getRemoteServers
 */
exports.getRemoteServers = async() => {
    return new Promise((resolve, reject) => {
        db.RemoteServers.find({}, (err, docs) => {
            if (err && reject) {
                reject(err);
            } else if (!err) {
                resolve(docs);
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
                reject(err);
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
                    reject(err);
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
                    reject(err);
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
                reject(err);
            } else if (!err) {
                resolve(docs.length == 1 ? docs[0] : null);
            }
        });
    });
};

/**
 * removeRemoteServer
 * @param {*} remoteInstance 
 */
exports.removeRemoteServer = async(remoteInstance) => {
    return new Promise((resolve, reject) => {
        db.RemoteServers.remove({ _id: remoteInstance._id }, {}, (err, numRemoved) => {
            if (err && reject) {
                reject(err);
            } else if (!err) {
                resolve();
            }
        });
    });
};

/**
 * _escapeFieldNames
 * @param {*} obj 
 */
function _escapeFieldNames(obj) {
    for (let f in obj) {
        if (f != "_id") {
            if (typeof obj[f] == 'object') {
                obj[f] = _escapeFieldNames(obj[f]);
            } else {
                let newF = f;
                while (newF.indexOf(".") != -1) {
                    newF = f.replace(".", "__dot__");
                }
                if (newF != f) {
                    obj[newF] = obj[f];
                    delete obj[f];
                }
            }
        }
    }
    return obj;
}

/**
 * _escapeFieldNames
 * @param {*} obj 
 */
function _unescapeFieldNames(obj) {
    for (let f in obj) {
        if (f != "_id") {
            if (typeof obj[f] == 'object') {
                obj[f] = _unescapeFieldNames(obj[f]);
            } else {
                let newF = f;
                while (newF.indexOf("__dot__") != -1) {
                    newF = f.replace("__dot__", ".");
                }
                if (newF != f) {
                    obj[newF] = obj[f];
                    delete obj[f];
                }
            }
        }
    }
    return obj;
}

/**
 * saveImageRunConfig
 * @param {*} image 
 * @param {*} settings 
 * @param {*} session 
 */
exports.logNlpMissmatch = async(nlpResult, stack, session) => {
    return new Promise((resolve, reject) => {
        db.NlpMissmatches.insert({
            "nlpResult": nlpResult,
            "stack": stack,
            "session": session
        }, (err, newDoc) => {});
    });
};