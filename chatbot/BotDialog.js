const Bot = new require("./Bot");
var { prompt } = require('inquirer');
const chalk = require("chalk");

/**
 * BotDialog
 */
let BotDialog = function(DialogJson) {
    this.bot = new Bot({
        "rasa_uri": "http://localhost:5000",
        "threshold": 0.49
    });
    this.dialogJson = DialogJson;
    this.actionHandlers = {};
    this.slotValidatorHandlers = {};
    this.session = {
        "position": this.dialogJson.dialog.id,
        "entities": {},
        "attributes": {}
    };
}

/**
 * start
 */
BotDialog.prototype.start = function() {
    this.stack = this.dialogJson.dialog.stack;
    stackMatch = this.stack.find(stackObj => stackObj.name == "&welcome");

    (async() => {
        await processStackMatch.call(this, stackMatch);
    })();
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
 * addSlotValidator
 * @param {*} validatorName 
 * @param {*} handler 
 */
BotDialog.prototype.addSlotValidator = function(validatorName, handler) {
    this.slotValidatorHandlers[validatorName] = handler;
}

/**
 * processStackMatch
 * @param {*} stackMatch 
 */
let processStackMatch = function(stackMatch) {
    return new Promise((resolve, reject) => {
        (async() => {
            // *************** PROCESS SLOTS ********************
            await processSlots.call(this, stackMatch);
            await processActions.call(this, stackMatch);

            // *************** DISPLAY POTENTIAL RESPONSE ********************
            if (stackMatch.responses && stackMatch.responses.length > 0) {
                console.log(chalk.yellow(stackMatch.responses[Math.floor(Math.random() * stackMatch.responses.length)]));
            }

            // *************** NOW LET THE USER INPUT NEXT QUESTION ********************
            if (stackMatch.jump) {
                await jumpToStem.call(this, stackMatch.jump);
            } else {
                // If stackMatch has a child dialog, change session position
                if (stackMatch.dialog) {
                    // StackSlot has NO message for user, we look for matching slot in new stack to move forward in the dialog
                    if (!stackMatch.responses || stackMatch.responses.length == 0) {
                        // Process post stack actions
                        await processPostActions.call(this, stackMatch);
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
                        await processPostActions.call(this, stackMatch);
                        // Position in new stack level
                        await initNewDialogTree.call(this, stackMatch);

                        this.stack = stackMatch.dialog.stack;
                    }
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
        this.stack = dialogStacks[0];
        match = evaluateStackObjects.call(this, nluResponse.intent);
    }
    return match;
}

/**
 * 
 * @param {*} jump 
 */
let jumpToStem = async function(jump) {
    let jumpMatches = getStackAndDialogItems.call(this, jump.name, this.dialogJson.dialog);
    this.session.position = jumpMatches[0].position;
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
                        if (stackObjectEntityCondition.operator == "==") {
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
                        if (stackObjectAttributeCondition.operator == "==") {
                            if (stackObjectAttributeCondition.value == this.session.attributes[stackObjectAttributeCondition.name]) {
                                return true;
                            } else {
                                return false;
                            }
                        } else if (stackObjectAttributeCondition.operator == "!=") {
                            if (stackObjectAttributeCondition.value != this.session.attributes[stackObjectAttributeCondition.name]) {
                                return true;
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
                "stackItem": stackItem
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
                    console.log(chalk.yellow(slot.questions[Math.floor(Math.random() * slot.questions.length)]));
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
                        console.log("");

                        if (this.slotValidatorHandlers[slot.entity]) {
                            let valideResponse = await this.slotValidatorHandlers[slot.entity](slotResponse.slotValue);
                            if (valideResponse) {
                                this.session.entities[slot.entity] = valideResponse;
                                _proceed = true;
                            } else {
                                if (slot.invalideResponses && slot.invalideResponses.length > 0) {
                                    console.log(chalk.yellow(slot.invalideResponses[Math.floor(Math.random() * slot.invalideResponses.length)]));
                                } else {
                                    console.log(chalk.yellow("I do not understand."));
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
                                console.log(chalk.yellow(slot.invalideResponses[Math.floor(Math.random() * slot.invalideResponses.length)]));
                            } else {
                                console.log(chalk.yellow("I do not understand."));
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
let processActions = async function(stackMatch) {
    if (stackMatch.action) {
        if (this.actionHandlers[stackMatch.action]) {
            await this.actionHandlers[stackMatch.action](this.session);
        } else {
            throw new Error("Missing action handler: " + stackMatch.action);
        }
    }
}

/**
 * processPostActions
 * @param {*} stackMatch 
 */
let processPostActions = async function(stackMatch) {
    if (stackMatch.postAction) {
        if (this.actionHandlers[stackMatch.postAction]) {
            await this.actionHandlers[stackMatch.postAction](this.session);
        } else {
            throw new Error("Missing action handler: " + stackMatch.postAction);
        }
    }
}

/**
 * initNewDialogTree
 * @param {*} stackMatch 
 */
let initNewDialogTree = async function(stackMatch) {
    this.session.position = stackMatch.dialog.id;

    // If new Dialog stack has a welcome node, we display it's text content first
    let welcomeNode = stackMatch.dialog.stack.find(stackObj => stackObj.name == "&welcome");
    if (welcomeNode) {
        console.log(chalk.yellow(welcomeNode.responses[Math.floor(Math.random() * welcomeNode.responses.length)]));
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
    console.log("");

    // Ask NLU engine to evaluate user text input
    let botResponse = await this.bot.say({ "text": promptResponse.userInput });

    // If intent detected by NLU engine
    if (botResponse.intent) {
        // We save the entities found first
        if (botResponse.entities && botResponse.entities.length > 0) {
            for (let i = 0; i < botResponse.entities.length; i++) {
                if (botResponse.entities[i].confidence > 0.3) {
                    this.session.entities[botResponse.entities[i].entity] = botResponse.entities[i].value;
                }
            }
        }

        // Look in current dialog stack for a match, if none found the $otherwise node will be returned
        stackMatch = processNLUResponse.call(this, botResponse);
        if (stackMatch) {
            // Process post stack actions
            await processPostActions.call(this, stackMatch);

            await processStackMatch.call(this, stackMatch);
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