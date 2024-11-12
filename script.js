// Shadowrun 6E Dice Roller Function
function rollDice(pool, explode = false, wild = false) {
    let result = [];
    let hits = 0;
    let protectedOnes = 0;
    let oneProtect = false;
    let glitch = false;
    let boon = false;
    let bust = false;

    // Roll the main dice pool
    for (let i = 0; i < pool; ) {
        let roll = Math.floor(Math.random() * 6) + 1;
        result.push(roll);

        // Check if this roll should be "protected"
        if (oneProtect && roll === 1) {
            protectedOnes += 1;
        }
        oneProtect = false;

        // Handle "exploding" 6s
        if (explode && roll === 6) {
            oneProtect = true; // Enable protection for the next roll
        } else {
            i += 1; // Only count non-exploding dice towards the pool
        }
    }

    // Determine glitch
    let onesCount = result.filter(roll => roll === 1).length;
    glitch = (onesCount - protectedOnes) >= Math.floor(pool / 2);

    // Handle the wild die, if applicable
    if (wild) {
        let wildRoll = Math.floor(Math.random() * 6) + 1;
        result.push(wildRoll);

        if ([5, 6].includes(wildRoll)) {
            boon = true;
        } else if (wildRoll === 1) {
            bust = true;
        }

        // Additional exploding for wild die
        if (explode && wildRoll === 6) {
            while (wildRoll === 6) {
                wildRoll = Math.floor(Math.random() * 6) + 1;
                result.push(wildRoll);
            }
        }
    }

    // Count hits
    hits = result.filter(roll => [5, 6].includes(roll)).length;
    if (boon) hits += 3;
    if (bust) hits -= result.filter(roll => roll === 6).length;

    return { result, hits, glitch };
}

// Defense Test Handler Function
function handleDefenseTest(hits, dv, actorId) {
    const actor = game.actors.get(actorId);
    if (!actor || !actor.isOwner) {
        ui.notifications.warn("You do not own this actor.");
        return;
    }

    // Load necessary actor data for defense test
    const reaction = actor.system.attributes.reaction.value + (actor.system.attributes.reaction.temp || 0);
    const intuition = actor.system.attributes.intuition.value + (actor.system.attributes.intuition.temp || 0);
    const defensePool = reaction + intuition;

    // Show dialog for defense test modifiers
    new Dialog({
        title: "Defense Test",
        content: `
            <form>
                <div class="form-group">
                    <label>Modifier</label>
                    <input type="number" name="modifier" value="0"/>
                </div>
                <div class="form-group">
                    <label>Explode Sixes</label>
                    <input type="checkbox" name="explode"/>
                </div>
                <div class="form-group">
                    <label>Wild Die</label>
                    <input type="checkbox" name="wild"/>
                </div>
            </form>
        `,
        buttons: {
            roll: {
                label: "Roll Defense",
                callback: html => {
                    const modifier = parseInt(html.find('input[name="modifier"]').val()) || 0;
                    const explode = html.find('input[name="explode"]').is(':checked');
                    const wild = html.find('input[name="wild"]').is(':checked');
                    const finalDefensePool = defensePool + modifier;

                    // Roll defense
                    const defenseResult = rollDice(finalDefensePool, explode, wild);
                    const defenseHits = defenseResult.hits;
                    const netHits = Math.max(0, hits - defenseHits);

                    // Calculate Damage
                    let damage = dv + netHits;
                    
                    // Display defense test results
                    const defenseTable = `
                        <table>
                            <tr>
                                <th>Defense Test Hits</th>
                                <td>${defenseHits}</td>
                            </tr>
                            <tr>
                                <th>Net Hits</th>
                                <td>${netHits}</td>
                            </tr>
                            ${netHits > 0 ? `
                            <tr>
                                <th>Damage</th>
                                <td>${damage}</td>
                            </tr>` : `
                            <tr>
                                <td colspan="2"><strong>Dodged!</strong></td>
                            </tr>`}
                        </table>
                    `;
                    
                    ChatMessage.create({ content: defenseTable });

                    if (netHits > 0) {
                        // Proceed to Soak Test
                        handleSoakTest(damage, actor);
                    }
                }
            }
        },
        default: "roll"
    }).render(true);
}

// Soak Test Handler Function
function handleSoakTest(damage, actor) {
    // Load necessary actor data for soak test
    const body = actor.system.attributes.body.value + (actor.system.attributes.body.temp || 0);

    // Show dialog for soak test modifiers
    new Dialog({
        title: "Soak Test",
        content: `
            <form>
                <div class="form-group">
                    <label>Modifier</label>
                    <input type="number" name="modifier" value="0"/>
                </div>
                <div class="form-group">
                    <label>Explode Sixes</label>
                    <input type="checkbox" name="explode"/>
                </div>
                <div class="form-group">
                    <label>Wild Die</label>
                    <input type="checkbox" name="wild"/>
                </div>
            </form>
        `,
        buttons: {
            roll: {
                label: "Roll Soak",
                callback: html => {
                    const modifier = parseInt(html.find('input[name="modifier"]').val()) || 0;
                    const explode = html.find('input[name="explode"]').is(':checked');
                    const wild = html.find('input[name="wild"]').is(':checked');
                    const finalSoakPool = body + modifier;

                    // Roll soak
                    const soakResult = rollDice(finalSoakPool, explode, wild);
                    const soakedDamage = Math.max(0, damage - soakResult.hits);

                    // Display soak test results
                    const soakTable = `
                        <table>
                            <tr><th>Soaked Damage</th><td>${soakedDamage}</td></tr>
                        </table>
                    `;
                    ChatMessage.create({ content: soakTable });
                }
            }
        },
        default: "roll"
    }).render(true);
}

// Add button to chat message for defense test, ensuring only one button is added
Hooks.on("renderChatMessage", (message, html) => {
    const flags = message.flags["shadowrun-defense-test"];
    if (flags?.defenseButton) {
        // Remove any existing button to avoid duplicates
        html.find(".defense-test-btn").remove();

        // Create and append the button
        const button = $(`<button class="defense-test-btn">Defense Test</button>`);
        button.on("click", () => {
            const { hits, dv, actorId } = flags;
            handleDefenseTest(hits, dv, actorId);
        });
        html.find(".message-content").append(button);
    }
});

// Adds Combat Setup Dialog functionality to the module
function openCombatSetupDialog() {
    const ownedActors = game.actors.filter(actor => actor.isOwner && actor.type === "character");

    if (ownedActors.length === 0) {
        ui.notifications.warn("You do not own any actors to perform this action.");
        return;
    }

    let selectedActor = ownedActors.length === 1 ? ownedActors[0] : null;
    const targetTokens = Array.from(game.user.targets);

    if (targetTokens.length !== 1) {
        ui.notifications.warn("Please select a single target using the targeting tool.");
        return;
    }

    const targetActor = targetTokens[0].actor;
    let actorOptions = ownedActors.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join("");

    new Dialog({
        title: "Combat Setup",
        content: getCombatSetupContent(ownedActors, selectedActor, actorOptions),
        buttons: {
            ok: {
                label: "Confirm",
                callback: (html) => handleCombatSetupConfirm(html, selectedActor, targetActor)
            },
            cancel: { label: "Cancel" }
        },
        render: (html) => renderCombatSetupDialog(html, selectedActor, targetActor),
        default: "ok"
    }).render(true);
}

// Helper function to generate the HTML content for the combat setup dialog
function getCombatSetupContent(ownedActors, selectedActor, actorOptions) {
    return `
        <form>
        ${ownedActors.length === 1 ? `<p>Actor: ${selectedActor.name}</p>` : `
        <div class="form-group">
            <label for="actor-select">Actor:</label>
            <select id="actor-select">${actorOptions}</select>
        </div>`}
        
        <div class="form-group">
            <label for="weapon-select">Weapon:</label>
            <select id="weapon-select" disabled></select>
        </div>
        
        <div class="form-group" id="range-mode-container" style="display: none;">
            <label for="range-select">Range:</label>
            <select id="range-select"></select>
            <label for="mode-select">Mode:</label>
            <select id="mode-select"></select>
        </div>
        
        <div class="form-group" id="attribute-select-container" style="display: none;">
            <label for="attribute-select">Attribute:</label>
            <select id="attribute-select">
                <option value="agility">Agility</option>
                <option value="strength">Strength</option>
            </select>
        </div>
        
        <div class="form-group">
            <label for="attack-rating">Attack Rating:</label>
            <input id="attack-rating" type="text" readonly />
            <label for="modifier">Modifier:</label>
            <input id="modifier" type="number" value="0" />
        </div>
        
        <div class="form-group">
            <label for="damage-value">Base Damage:</label>
            <input id="damage-value" type="text" readonly />
        </div>
        
        <div class="form-group">
            <label for="defense-rating">Target Defense Rating:</label>
            <input id="defense-rating" type="text" readonly />
        </div>
        </form>
    `;
}

// Function to handle dialog confirmation and open additional options
function handleCombatSetupConfirm(html, selectedActor, targetActor) {
    const actorId = selectedActor ? selectedActor.id : html.find("#actor-select").val();
    const weaponId = html.find("#weapon-select").val();
    const rangeCategory = html.find("#range-select").val();
    const mode = html.find("#mode-select").val();
    const attribute = html.find("#attribute-select").val();
    const modifier = parseInt(html.find("#modifier").val(), 10);

    const actor = game.actors.get(actorId);
    const weapon = actor.items.get(weaponId);

    if (actor && weapon && targetActor) {
        // Further calculations for attack rating, damage, and defense rating here

        // Display edge gain information in chat
        displayEdgeGain(actor, targetActor, attackRating, targetDefenseRating);

        // Open additional options dialog
        openAdditionalOptionsDialog(actor);
    } else {
        ui.notifications.warn("Please select a valid actor and weapon.");
    }
}

// Function to display edge gain in chat
function displayEdgeGain(actor, targetActor, attackRating, targetDefenseRating) {
    let bonusEdge = Math.floor(Math.abs(attackRating - targetDefenseRating) / 4);
    let edge_bias = Math.sign(attackRating - targetDefenseRating);

    if (edge_bias > 0) {
        ChatMessage.create({
            user: game.user.id,
            speaker: { alias: actor.name },
            content: `${actor.name} gains ${bonusEdge} Edge for having an attack rating substantially higher than ${targetActor.name}'s defense rating.`
        });
    } else if (edge_bias < 0) {
        ChatMessage.create({
            user: game.user.id,
            speaker: { alias: actor.name },
            content: `${targetActor.name} gains ${bonusEdge} Edge for having a defense rating substantially higher than ${actor.name}'s attack rating.`
        });
    }
}

// Function to open additional options dialog for further action
function openAdditionalOptionsDialog(actor) {
    // Generate skill and attribute options for further actions
    const skills = Object.entries(actor.system.skills.active)
        .filter(([_, skill]) => !skill.hidden)
        .map(([key, skill]) => ({ key, label: skill.name }));
    const attributes = Object.keys(actor.system.attributes)
        .filter(attr => ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma"].includes(attr));

    const skillOptions = skills.map(skill => `<option value="${skill.key}">${skill.label}</option>`).join("");
    const attributeOptions = attributes.map(attr => `<option value="${attr}">${attr.charAt(0).toUpperCase() + attr.slice(1)}</option>`).join("");

    new Dialog({
        title: "Additional Options",
        content: `
            <form>
                <div class="form-group">
                    <label for="skill-select">Skill:</label>
                    <select id="skill-select">${skillOptions}</select>
                </div>
                <div class="form-group">
                    <label for="attribute-select">Attribute:</label>
                    <select id="attribute-select">${attributeOptions}</select>
                </div>
                <div class="form-group">
                    <label for="modifier">Modifier:</label>
                    <input id="modifier" type="number" value="0" />
                </div>
                <div class="form-group">
                    <label for="wild-die">Wild Die:</label>
                    <input id="wild-die" type="checkbox" />
                </div>
                <div class="form-group">
                    <label for="explode-sixes">Explode Sixes:</label>
                    <input id="explode-sixes" type="checkbox" />
                </div>
                <div class="form-group">
                    <label for="dice-pool">Dice Pool:</label>
                    <input id="dice-pool" type="text" readonly />
                </div>
            </form>
        `,
        buttons: {
            ok: { label: "Roll Dice", callback: (html) => rollDiceAndDisplayResult(html, actor) },
            cancel: { label: "Cancel" }
        },
        render: (html) => setupDicePoolUpdate(html, actor),
        default: "ok"
    }).render(true);
}

// Function to update the dice pool dynamically
function setupDicePoolUpdate(html, actor) {
    const updateDicePool = () => {
        const selectedSkill = html.find("#skill-select").val();
        const selectedAttribute = html.find("#attribute-select").val();
        const modifier = parseInt(html.find("#modifier").val(), 10) || 0;

        const skillBase = actor.system.skills.active[selectedSkill]?.base || 0;
        const attributeBase = actor.system.attributes[selectedAttribute]?.base || 0;
        const attributeTemp = actor.system.attributes[selectedAttribute]?.temp || 0;

        const dicePool = skillBase + attributeBase + attributeTemp + modifier;
        html.find("#dice-pool").val(dicePool);
    };

    html.find("#skill-select, #attribute-select").change(updateDicePool);
    html.find("#modifier").on("input", updateDicePool);
    updateDicePool();
}

// Expose openCombatSetupDialog function for external calls
window.openCombatSetupDialog = openCombatSetupDialog;
