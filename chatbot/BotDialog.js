const Bot = new require("./Bot");
var { prompt } = require('inquirer');
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");
let globalStack = null

let ENTITY_MATCH = /@\[(.*?)\]/;
let ATTRIBUTE_MATCH = /&\[(.*?)\]/;

/**
 * BotDialog
 */
let BotDialog = function(config) {
    // Init BotDialog config object
    let defaults = {
        "flowBasePath": "./flow",
        "flowName": "default"
    }
    if (config) {
        if (config.flowBasePath) {
            defaults.flowBasePath = config.flowBasePath;
        }
        if (config.flowName) {
            defaults.flowName = config.flowName;
        }
    }
    this.config = defaults;

    let globalJsonPath = path.join(this.config.flowBasePath, "stacks", "globals.json");
    if (fs.existsSync(globalJsonPath)) {
        globalStack = require(globalJsonPath);
    } else {
        globalStack = [];
    }

    // Init Bot config object
    let botConfig = {};
    if (config.rasaUri) {
        botConfig.rasaUri = config.rasaUri;
    }
    if (config.intentProjectModel) {
        botConfig.intentProjectModel = config.intentProjectModel;
    }
    if (config.entityProjectModel) {
        botConfig.entityProjectModel = config.entityProjectModel;
    }
    if (config.baseNluConfidenceThreshold) {
        botConfig.threshold = config.baseNluConfidenceThreshold;
    }
    this.bot = new Bot(botConfig);

    this.dialogJson = resolveDialogTree.call(this);

    this.conditionMatcherHandlers = {};
    this.slotValidatorHandlers = {};
    this.actionHandlers = {};

    this.eventCallbacks = {
        "text": [],
        "missmatch": []
    };

    this.session = {
        "entities": {},
        "attributes": {}
    };

    setPosition.call(this, this.dialogJson.dialog.id, this.dialogJson.dialog.nlu_threshold != undefined ? this.dialogJson.dialog.nlu_threshold : null);
}

/**
 * start
 */
BotDialog.prototype.start = function() {
    setStack.call(this, this.dialogJson.dialog.stack);
    stackMatch = this.stack.find(stackObj => stackObj.name == "&welcome");

    (async() => {
        await processStackMatch.call(this, stackMatch);
    })();
}

/**
 * on
 * @param {*} event 
 * @param {*} cb 
 */
BotDialog.prototype.on = function(event, cb) {
    if (this.eventCallbacks[event]) {
        this.eventCallbacks[event].push(cb);
    }
}

/**
 * addActionHandler
 * @param {*} actionName 
 * @param {*} handler 
 */
BotDialog.prototype.addActionHandler = function(actionName, handler) {
    this.actionHandlers[actionName] = handler;
}

/**
 * addConditionMatchHandler
 * @param {*} matchTypeName 
 * @param {*} handler 
 */
BotDialog.prototype.addConditionMatchHandler = function(matchTypeName, handler) {
    this.conditionMatcherHandlers[matchTypeName] = handler;
}

/**
 * addSlotValidator
 * @param {*} validatorName 
 * @param {*} handler 
 */
BotDialog.prototype.addSlotValidator = function(validatorName, handler) {
    this.slotValidatorHandlers[validatorName] = handler;
}

/**
 * setStack
 * @param {*} stack 
 */
let setStack = function(stack) {
    let extraStack = globalStack.map((s) => {
        if (s.name.indexOf("&") == -1) {
            let updStack = Object.assign({}, s);
            updStack.name = this.session.position + "_" + updStack.name;
            return updStack;
        } else {
            return s;
        }
    });
    this.stack = stack.concat(extraStack);
}

/**
 * setPosition
 * @param {*} id 
 * @param {*} threshold 
 */
let setPosition = function(id, threshold) {
    this.session.position = id;
    this.session.nluThreshold = threshold;
}

/**
 * resolveDialogTree
 * @param {*} configBaseFolder 
 */
let resolveDialogTree = function() {
    function iterateStackNode(stackNode) {
        if (stackNode.dialog) {
            if (typeof stackNode.dialog == "string") {
                stackNode.dialog = require(path.join(this.config.flowBasePath, "dialogs", stackNode.dialog + ".json"));
            }
            stackNode.dialog.stack.forEach(iterateStackNode.bind(this));
        }
    }

    function iterateStackList(stackList) {
        for (let i = 0; i < stackList.length; i++) {
            if (stackList[i].import) {
                let importStacks = require(path.join(this.config.flowBasePath, "stacks", stackList[i].import+".json"));
                // Remove import placeholder
                stackList.splice(i, 1);
                // Insert imported objects
                stackList.splice(i, 0, ...importStacks);
                // Reiterate at same index
                i--;
            } else if (stackList[i].dialog) {
                iterateStackList.call(this, stackList[i].dialog.stack);
            }
        }
    }

    let jsonTree = require(path.join(this.config.flowBasePath, this.config.flowName + ".json"));
    iterateStackNode.call(this, jsonTree);
    iterateStackList.call(this, jsonTree.dialog.stack);

    return jsonTree;
}

/**
 * processStackMatch
 * @param {*} stackMatch 
 */
let processStackMatch = function(stackMatch, botResult) {
    return new Promise((resolve, reject) => {
        (async() => {
            await processPreActions.call(this, stackMatch, botResult ? botResult : null);

            // Could not match anything, we log this
            if (stackMatch.name == "&otherwise") {
                if (this.eventCallbacks.missmatch.length > 0) {
                    this.eventCallbacks.missmatch.forEach(cb => {
                        cb(botResult ? botResult : null, this.stack.map(s => {
                            let stack = Object.assign({}, s);
                            if (stack.dialog) {
                                stack.dialog = stack.dialog.id;
                            }
                            return stack;
                        }), this.session);
                    });
                }
            }

            // *************** PROCESS SLOTS ********************
            await processSlots.call(this, stackMatch);

            // *************** DISPLAY POTENTIAL RESPONSE ********************
            if (stackMatch.responses && stackMatch.responses.length > 0) {
                await textOutput.call(this, (stackMatch.responses[Math.floor(Math.random() * stackMatch.responses.length)]));
            }

            await processActions.call(this, stackMatch, botResult ? botResult : null);

            // *************** NOW LET THE USER INPUT NEXT QUESTION ********************
            if (stackMatch.jump) {
                // Process post stack actions
                await processPostActions.call(this, stackMatch, botResult ? botResult : null);

                await jumpToStep.call(this, stackMatch.jump);
            } else {
                // If stackMatch has a child dialog, change session position
                if (stackMatch.dialog) {
                    // StackSlot has NO message for user, we look for matching slot in new stack to move forward in the dialog
                    if (!stackMatch.responses || stackMatch.responses.length == 0) {
                        // Process post stack actions
                        await processPostActions.call(this, stackMatch, botResult ? botResult : null);
                        // Position in new stack level
                        await initNewDialogTree.call(this, stackMatch);
                        // Pass empty NLU response to trigger detection without an intent
                        let subStackMatch = processNLUResponse.call(this, {});
                        if (subStackMatch) {
                            await processStackMatch.call(this, subStackMatch);
                        } else {
                            await processStackMatch.call(this, {
                                "name": "&otherwise",
                                "responses": ["Sorry, I did not understand that. Can you please rephrase?"]
                            });
                        }
                    } else {
                        // Process post stack actions
                        await processPostActions.call(this, stackMatch, botResult ? botResult : null);
                        // Position in new stack level
                        await initNewDialogTree.call(this, stackMatch);

                        setStack.call(this, stackMatch.dialog.stack);
                    }
                } else {
                    // Process post stack actions
                    await processPostActions.call(this, stackMatch, botResult ? botResult : null);
                }
                // StackSlot has a message for user, we ask for a response right away
                if (stackMatch.responses && stackMatch.responses.length > 0) {
                    await queryUserInputAndEvaluate.call(this, stackMatch);
                }
            }
        })();
    });
}

/**
 * processNLUResponse
 * @param {*} response 
 */
let processNLUResponse = function(nluResponse) {
    let match = null;
    let dialogStacks = getDialogStacks(this.dialogJson.dialog, this.session.position);
    if (dialogStacks && dialogStacks.length == 1) {
        setStack.call(this, dialogStacks[0]);
        match = evaluateStackObjects.call(this, nluResponse.intent);
    }
    return match;
}

/**
 * 
 * @param {*} jump 
 */
let jumpToStep = async function(jump) {
    let jumpMatches = getStackAndDialogItems.call(this, jump.name, this.dialogJson.dialog);
    setPosition.call(this, jumpMatches[0].position, jumpMatches[0].nluThreshold);
    await processStackMatch.call(this, jumpMatches[0].stackItem);
}

/**
 * evaluateStackObjects
 * @param {*} intent 
 */
let evaluateStackObjects = function(intent) {
    let match = this.stack.find((stackObj) => {
        if (stackObj.condition) {
            // Match intent in any
            let intentMatch = false;
            let entitiesMatch = false;

            if (intent) {
                if (stackObj.condition.intent == intent.name) {
                    intentMatch = true;
                }
            } else {
                intentMatch = true;
            }

            // Match entities
            if (intentMatch) {
                if (stackObj.condition.entities && stackObj.condition.entities.length > 0) {
                    let matchingEntities = stackObj.condition.entities.filter(stackObjectEntityCondition => {
                        if (stackObjectEntityCondition.matcher) {
                            if (this.session.entities[stackObjectEntityCondition.name]) {
                                return evaluateConditionMatcher.call(this, stackObjectEntityCondition.matcher, this.session.entities[stackObjectEntityCondition.name]);
                            } else {
                                return false;
                            }
                        } else if (stackObjectEntityCondition.operator == "==") {
                            if (stackObjectEntityCondition.value == this.session.entities[stackObjectEntityCondition.name]) {
                                return true;
                            } else {
                                return false;
                            }
                        } else if (stackObjectEntityCondition.operator == "!=") {
                            if (stackObjectEntityCondition.value != this.session.entities[stackObjectEntityCondition.name]) {
                                return true;
                            } else {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    });

                    if (matchingEntities.length == stackObj.condition.entities.length) {
                        entitiesMatch = true;
                    } else {
                        return false;
                    }
                }

                if (stackObj.condition.attributes && stackObj.condition.attributes.length > 0) {
                    let matchingAttributes = stackObj.condition.attributes.filter(stackObjectAttributeCondition => {
                        if (this.session.attributes[stackObjectAttributeCondition.name]) {
                            if (stackObjectAttributeCondition.matcher) {
                                if (this.session.attributes[stackObjectAttributeCondition.name]) {
                                    return evaluateConditionMatcher.call(this, stackObjectAttributeCondition.matcher, this.session.attributes[stackObjectAttributeCondition.name].value);
                                } else {
                                    return false;
                                }
                            }
                            if (stackObjectAttributeCondition.operator == "==") {
                                if (stackObjectAttributeCondition.value == this.session.attributes[stackObjectAttributeCondition.name].value) {
                                    return true;
                                } else {
                                    return false;
                                }
                            } else if (stackObjectAttributeCondition.operator == "!=") {
                                if (stackObjectAttributeCondition.value != this.session.attributes[stackObjectAttributeCondition.name].value) {
                                    return true;
                                } else {
                                    return false;
                                }
                            } else {
                                return false;
                            }
                        } else {
                            return false;
                        }
                    });

                    if (matchingAttributes.length != stackObj.condition.attributes.length) {
                        return false;
                    }
                }
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    });

    if (!match) {
        return this.stack.find(stackObj => stackObj.name == "&otherwise");
    } else {
        return match;
    }
}

/**
 * getDialogStacks
 * @param {*} dialog 
 * @param {*} position 
 * @param {*} matchArray 
 */
let getDialogStacks = function(dialog, position, matchArray) {
    if (dialog.id == position) {
        matchArray = matchArray ? matchArray.concat(dialog.stack) : [dialog.stack];
    } else {
        dialog.stack.forEach((conditionObj) => {
            if (conditionObj.dialog) {
                matchArray = getDialogStacks(conditionObj.dialog, position, matchArray);
            }
        });
    }
    return matchArray;
}

/**
 * getStackAndDialogItems
 * @param {*} name 
 * @param {*} dialog 
 * @param {*} matchArray 
 */
let getStackAndDialogItems = function(name, dialog, matchArray) {
    dialog.stack.forEach(stackItem => {
        if (stackItem.name == name) {
            let item = {
                "position": dialog.id,
                "stackItem": stackItem,
                "nluThreshold": dialog.nlu_threshold != undefined ? dialog.nlu_threshold : null
            };
            matchArray = matchArray ? matchArray.concat(item) : [item];
        }
        if (stackItem.dialog) {
            matchArray = getStackAndDialogItems(name, stackItem.dialog, matchArray);
        }
    });
    return matchArray;
}

/**
 * processSlots
 * @param {*} stackMatch 
 */
let processSlots = async function(stackMatch) {
    if (stackMatch.slots) {
        for (let i = 0; i < stackMatch.slots.length; i++) {
            let slot = stackMatch.slots[i];

            let _proceed = false;
            while (!_proceed) {
                if (this.session.entities[slot.entity] == undefined) {
                    await textOutput.call(this, slot.questions[Math.floor(Math.random() * slot.questions.length)]);
                    // Use provided action to fill slot
                    if (slot.action) {
                        if (this.actionHandlers[slot.action]) {
                            let slotValue = await this.actionHandlers[slot.action](this.session);
                            this.session.entities[slot.entity] = slotValue;
                            _proceed = true;
                        } else {
                            throw new Error("Missing action handler: " + slot.action);
                        }
                    }
                    // Ask user for slot value
                    else {
                        // Collect user input
                        let slotResponse = await prompt({
                            type: 'input',
                            name: 'slotValue',
                            message: ':',
                            validate: (data) => {
                                if (data.trim().length == 0) {
                                    return "Sorry, but I need this information to proceed.\n" + slot.questions[Math.floor(Math.random() * slot.questions.length)];
                                } else {
                                    return true;
                                }
                            }
                        });

                        if (this.slotValidatorHandlers[slot.entity]) {
                            let valideResponse = await this.slotValidatorHandlers[slot.entity](slotResponse.slotValue);
                            if (valideResponse) {
                                this.session.entities[slot.entity] = valideResponse;
                                _proceed = true;
                            } else {
                                if (slot.invalideResponses && slot.invalideResponses.length > 0) {
                                    await textOutput.call(this, slot.invalideResponses[Math.floor(Math.random() * slot.invalideResponses.length)]);
                                } else {
                                    await textOutput.call(this, "I do not understand.");
                                }
                            }
                        } else {
                            this.session.entities[slot.entity] = slotResponse.slotValue;
                            _proceed = true;
                        }
                    }
                } else {
                    if (this.slotValidatorHandlers[slot.entity]) {
                        let valideResponse = await this.slotValidatorHandlers[slot.entity](this.session.entities[slot.entity]);
                        if (valideResponse) {
                            this.session.entities[slot.entity] = valideResponse;
                            _proceed = true;
                        } else {
                            if (slot.invalideResponses && slot.invalideResponses.length > 0) {
                                await textOutput.call(this, slot.invalideResponses[Math.floor(Math.random() * slot.invalideResponses.length)]);
                            } else {
                                await textOutput.call(this, "I do not understand.");
                            }
                            delete this.session.entities[slot.entity];
                        }
                    } else {
                        _proceed = true;
                    }
                }
            }
        }
    }
}

/**
 * processActions
 * @param {*} stackMatch 
 */
let processActions = async function(stackMatch, botResponse) {
    if (stackMatch.action) {
        if (this.actionHandlers[stackMatch.action]) {
            await this.actionHandlers[stackMatch.action](this.session, botResponse);
        } else {
            throw new Error("Missing action handler: " + stackMatch.action);
        }
    }
}

/**
 * processConditionMatcher
 * @param {*} value 
 * @param {*} matcherName 
 */
let evaluateConditionMatcher = function(matcherName, value) {
    if (this.conditionMatcherHandlers[matcherName]) {
        return this.conditionMatcherHandlers[matcherName](this.session, value);
    } else {
        throw new Error("Missing condition matcher handler: " + matcherName);
    }
}

/**
 * processPreActions
 * @param {*} stackMatch 
 */
let processPreActions = async function(stackMatch, botResponse) {
    if (stackMatch.preAction) {
        if (this.actionHandlers[stackMatch.preAction]) {
            await this.actionHandlers[stackMatch.preAction](this.session, botResponse);
        } else {
            throw new Error("Missing action handler: " + stackMatch.preAction);
        }
    }
}

/**
 * processPostActions
 * @param {*} stackMatch 
 */
let processPostActions = async function(stackMatch, botResponse) {
    if (stackMatch.postAction) {
        if (this.actionHandlers[stackMatch.postAction]) {
            await this.actionHandlers[stackMatch.postAction](this.session, botResponse);
        } else {
            throw new Error("Missing action handler: " + stackMatch.postAction);
        }
    }

    // Remove short lived attributes
    for (let attribute in this.session.attributes) {
        if (this.session.attributes[attribute].lifespan && this.session.attributes[attribute].lifespan.toLowerCase() == "step") {
            delete this.session.attributes[attribute];
        }
    }
}

/**
 * initNewDialogTree
 * @param {*} stackMatch 
 */
let initNewDialogTree = async function(stackMatch) {
    setPosition.call(this, stackMatch.dialog.id, stackMatch.dialog.nlu_threshold != undefined ? stackMatch.dialog.nlu_threshold : null);

    // If new Dialog stack has a welcome node, we display it's text content first
    let welcomeNode = stackMatch.dialog.stack.find(stackObj => stackObj.name == "&welcome");
    if (welcomeNode) {
        textOutput.call(this, welcomeNode.responses[Math.floor(Math.random() * welcomeNode.responses.length)]);
    }
}

/**
 * textOutput
 * @param {*} text 
 */
let textOutput = async function(text) {
    let match = ATTRIBUTE_MATCH.exec(text);
    if (match && match.length == 2) {
        text = text.split(match[0]).join(this.session.attributes[match[1]].value);
    }
    match = ENTITY_MATCH.exec(text);
    if (match && match.length == 2) {
        text = text.split(match[0]).join(this.session.entities[match[1]]);
    }

    if (this.eventCallbacks.text.length > 0) {
        for (let i = 0; i < this.eventCallbacks.text.length; i++) {
            await this.eventCallbacks.text[i](text, this.session);
        }
    } else {
        console.log(chalk.yellow(text));
    }
}

/**
 * queryUserInputAndEvaluate
 * @param {*} stackMatch 
 */
let queryUserInputAndEvaluate = async function(stackMatch) {
    // Collect user input
    let promptResponse = await prompt({
        type: 'input',
        name: 'userInput',
        message: ':'
    });

    // Proceed only if there is some text for us
    if (promptResponse.userInput.trim().length == 0) {
        await queryUserInputAndEvaluate.call(this, stackMatch);
        return;
    }

    // Ask NLU engine to evaluate user text input
    let botResponse = await this.bot.say({ "text": promptResponse.userInput, "threshold": this.session.nluThreshold });

    // console.log(JSON.stringify(this.stack, null, 4));
    // console.log(botResponse);

    // If intent detected by NLU engine
    if (botResponse.intent) {
        // We save the entities found first
        if (botResponse.entities && botResponse.entities.length > 0) {
            for (let i = 0; i < botResponse.entities.length; i++) {
                if (botResponse.entities[i].confidence > 0.2) {
                    this.session.entities[botResponse.entities[i].entity] = botResponse.entities[i].value;
                }
            }
        }

        // Look in current dialog stack for a match, if none found the $otherwise node will be returned
        stackMatch = processNLUResponse.call(this, botResponse);
        if (stackMatch) {
            await processStackMatch.call(this, stackMatch, botResponse);
        } else {
            await processStackMatch.call(this, {
                "name": "&otherwise",
                "responses": ["Sorry, I did not understand that. Can you please rephrase?"]
            });
        }
    }
    // NLU Engine could not detect an intent
    else {
        let otherwiseNode = this.stack.find(stackObj => stackObj.name == "&otherwise");
        if (otherwiseNode) {
            await processStackMatch.call(this, otherwiseNode);
        } else {
            await processStackMatch.call(this, {
                "name": "&otherwise",
                "responses": ["Sorry, I did not understand that. Can you please rephrase?"]
            });
        }
    }
}

module.exports = BotDialog;