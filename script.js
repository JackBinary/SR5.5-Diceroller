function rollDice(pool, explode = false, wild = false) {
    console.log(`RollDice: ${pool}`)
    let result = [];
    let hits = 0;
    let protectedOnes = 0;
    let oneProtect = false;
    let glitch = false;
    let boon = false;
    let bust = false;

    // Mapping for dice Unicode and colors
    const diceMapping = {
        1: { icon: "⚀", color: "red" },
        2: { icon: "⚁", color: "" },
        3: { icon: "⚂", color: "" },
        4: { icon: "⚃", color: "" },
        5: { icon: "⚄", color: "green" },
        6: { icon: "⚅", color: "green" }
    };

    // Roll the main dice pool
    for (let i = 0; i < pool; ) {
        let roll = Math.floor(Math.random() * 6) + 1;
        let rollColor = diceMapping[roll].color;
        if (oneProtect) {
            rollColor = "yellow"; // Mark exploded rolls as yellow
            if ([5,6].includes(roll)) {
                rollColor = "orange";
            }
        }

        // Check if this roll should be "protected"
        if (oneProtect && roll === 1) {
            protectedOnes += 1;
        }
        oneProtect = false;

        // Handle "exploding" 6s
        if (explode && roll === 6) {
            oneProtect = true; // Enable protection for the next roll
            result.push({ roll, color: rollColor }); // Push the 6 with yellow
        } else {
            result.push({ roll, color: rollColor });
            i += 1; // Only count non-exploding dice towards the pool
        }
    }

    // Determine glitch
    let onesCount = result.filter(r => r.roll === 1).length;
    glitch = (onesCount - protectedOnes) >= Math.floor(pool / 2);

    // Handle the wild die, if applicable
    if (wild) {
        let wildRoll = Math.floor(Math.random() * 6) + 1;
        let wildColor = "cyan"; // Wild die is cyan
        result.push({ roll: wildRoll, color: wildColor });

        if ([5, 6].includes(wildRoll)) {
            boon = true;
        } else if (wildRoll === 1) {
            bust = true;
        }

        // Additional exploding for wild die
        if (explode && wildRoll === 6) {
            while (wildRoll === 6) {
                wildRoll = Math.floor(Math.random() * 6) + 1;
                wildColor = "magenta"; // Exploded wild die is purple
                result.push({ roll: wildRoll, color: wildColor });
            }
        }
    }

    // Count hits
    hits = result.filter(r => [5, 6].includes(r.roll)).length;
    if (boon) hits += 2;
    if (bust) hits -= result.filter(r => r.roll === 5).length;

    // Map results to Unicode with color styling
    const formattedResult = result.map(({ roll, color }) => {
        const { icon } = diceMapping[roll];
        return `<span style="color: ${color};">${icon}</span>`;
    });

    return { result: formattedResult, hits, glitch };
}

// Defense Test Handler Function
function handleDefenseTest(hits, dv, actorId) {
    const actor = game.actors.get(actorId);
    if (!actor || !actor.isOwner) {
        ui.notifications.warn("You do not own this actor.");
        return;
    }

    // Load necessary actor data for defense test
    const reaction = actor.system.attributes.reaction.value;
    const intuition = actor.system.attributes.intuition.value;
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
                    console.log(`${actor.name}, Reaction: ${reaction}, Intuition: ${intuition}, Mod: ${modifier}`)

                    // Roll defense
                    const defenseResult = rollDice(finalDefensePool, explode, wild);
                    const defenseHits = defenseResult.hits;
                    const netHits = Math.max(0, hits - defenseHits);

                    // Calculate Damage
                    let damage = dv + netHits;
                    
                    // Display defense test results
                    const defenseTable = `
                        <h3>${actor.name} defends using Reaction + Intuition (Mod: ${modifier})</h3>
                        <table>
                            <tr>
                                <th>Result</th>
                                <td>
                                  ${defenseResult.result.join(' ')}
                                </td>
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
                            ${defenseResult.glitch === true ? `
                            <tr>
                                There was a glitch!
                            </tr>` : ``}
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
    const body = actor.system.attributes.body.value;

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
                        <h3>${actor.name} soaks using Body (Mod: ${modifier})</h3>
                        <table>
                            <tr>
                                <th>Result</th>
                                <td>
                                  ${soakResult.result.join(', ')}
                                  
                                </td>
                            </tr>
                            <tr>
                                <th>Soaked Damage</th>
                                <td>${soakedDamage}</td>
                            </tr>
                            ${soakResult.glitch === true ? `
                            <tr>
                                There was a glitch!
                            </tr>` : ``}
                        </table>
                    `;
                    ChatMessage.create({ content: soakTable });
                }
            }
        },
        default: "roll"
    }).render(true);
}

// Add button to chat message for defense test
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

// Combat Setup Function
async function setupCombatDialog() {
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
        title: "Edge Check",
        content: `
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
        </form>
        `,
        buttons: {
            ok: {
                label: "Prepare Attack",
                callback: (html) => {
                    const actorId = selectedActor ? selectedActor.id : html.find("#actor-select").val();
                    const weaponId = html.find("#weapon-select").val();
                    const rangeCategory = html.find("#range-select").val();
                    const mode = html.find("#mode-select").val();
                    const attribute = html.find("#attribute-select").val();
                    const modifier = parseInt(html.find("#modifier").val(), 10);
                    
                    const actor = game.actors.get(actorId);
                    const weapon = actor.items.get(weaponId);
                    
                    if (actor && weapon && targetActor) {
                        let attackRating = 0;
                        let baseDamage = weapon.system.action.damage.base;
                        
                        if (weapon.system.category === "melee") {
                            const agility = actor.system.attributes.agility.value + actor.system.attributes.agility.temp;
                            const strength = actor.system.attributes.strength.value + actor.system.attributes.strength.temp;
                            const reach = weapon.system.melee.reach;
                            
                            attackRating = attribute === "agility" ? agility + reach : strength + reach;
                        } else if (weapon.system.category === "range") {
                            const ranges = weapon.system.range.ranges;
                            attackRating = ranges[rangeCategory];
                            
                            if (mode === "semi_auto") {
                                attackRating -= 2;
                                baseDamage += 1;
                            } else if (mode === "burst_fire") {
                                attackRating -= 4;
                                baseDamage += 2;
                            } else if (mode === "full_auto") {
                                attackRating -= 6;
                                baseDamage += 3;
                            }
                        }
                        
                        attackRating += modifier;
                        
                        const baseDefense = targetActor.system.attributes.body.value;
                        const armorValue = targetActor.system.armor.value || 0;
                        const targetDefenseRating = baseDefense + armorValue;
                        
                        html.find("#attack-rating").val(attackRating);
                        html.find("#damage-value").val(baseDamage);
                        html.find("#defense-rating").val(targetDefenseRating);
                        
                        // Calculate edge gain according to house rule: +1 edge for every 4 points over defense rating
                        let bonusEdge = Math.floor(Math.abs(attackRating - targetDefenseRating) / 4);
                        let edge_bias = Math.sign(attackRating - targetDefenseRating);
                        
                        // Output edge gain information to chat
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
                        
                        // Open a new dialog for the actual attack
                        const skills = Object.entries(actor.system.skills.active).filter(([_, skill]) => !skill.hidden).map(([key, skill]) => ({ key, label: skill.name }));
                        const attributes = Object.keys(actor.system.attributes).filter(attr => ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma"].includes(attr));
                        
                        const skillOptions = skills.map(skill => `<option value="${skill.key}">${skill.label}</option>`).join("");
                        const attributeOptions = attributes.map(attr => `<option value="${attr}">${attr.charAt(0).toUpperCase() + attr.slice(1)}</option>`).join("");
                        
                        new Dialog({
                            title: "Prepare Attack",
                            content: `
                            <form>
                            <div class="form-group">
                            <label for="skill-select">Skill:</label>
                            <select id="skill-select">
                            ${skillOptions}
                            </select>
                            </div>
                            <div class="form-group">
                            <label for="attribute-select">Attribute:</label>
                            <select id="attribute-select">
                            ${attributeOptions}
                            </select>
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
                                ok: {
                                    label: "Roll Attack",
                                    callback: (html) => {
                                        const selectedSkill = html.find("#skill-select").val();
                                        const selectedSkillLabel = html.find("#skill-select option:selected").text();
                                        const selectedAttribute = html.find("#attribute-select").val();
                                        const selectedAttributeLabel = html.find("#attribute-select option:selected").text();
                                        const skillBase = actor.system.skills.active[selectedSkill].base;
                                        const attributeBase = actor.system.attributes[selectedAttribute].base;
                                        const attributeTemp = actor.system.attributes[selectedAttribute].temp || 0;
                                        const modifier = parseInt(html.find("#modifier").val(), 10) || 0;
                                        const useWildDie = html.find("#wild-die").is(":checked");
                                        const explodeSixes = html.find("#explode-sixes").is(":checked");
                                        const dicePool = skillBase + attributeBase + attributeTemp + modifier;
                                        
                                        const rollResult = rollDice(dicePool, explodeSixes, useWildDie);
                                        const hits = rollResult.hits;
                                        
                                        // Output result in chat
                                        ChatMessage.create({
                                            user: game.user.id,
                                            speaker: { alias: actor.name },
                                            content: `
                                                <h3>${actor.name} attacks ${targetActor.name} using ${selectedSkillLabel} + ${selectedAttributeLabel} (Mod: ${modifier})</h3>
                                                <table>
                                                    <tr>
                                                        <th>Result</th>
                                                        <td>
                                                          ${rollResult.result.join(', ')}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <th>Hits</th>
                                                        <td>${hits}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>DV</th>
                                                        <td>${baseDamage}</td>
                                                    </tr>
                                                    ${rollResult.glitch === true ? `
                                                    <tr>
                                                        There was a glitch!
                                                    </tr>` : ``}
                                                </table>
                                            `,
                                            flags: {
                                                "shadowrun-defense-test": {
                                                    defenseButton: true,
                                                    hits: hits,
                                                    dv: baseDamage,
                                                    actorId: targetActor.id
                                                }
                                            }
                                        });
                                    }
                                },
                                cancel: { label: "Cancel" }
                            },
                            render: (html) => {
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
                                
                                updateDicePool();
                                
                                html.find("#skill-select, #attribute-select").change(updateDicePool);
                                html.find("#modifier").on("input", updateDicePool);
                            },
                            default: "ok"
                        }).render(true);
                    } else {
                        ui.notifications.warn("Please select a valid actor and weapon.");
                    }
                }
            },
            cancel: { label: "Cancel" }
        },
        render: (html) => {
            const weaponSelect = html.find("#weapon-select");
            const rangeModeContainer = html.find("#range-mode-container");
            const attributeSelectContainer = html.find("#attribute-select-container");
            const defenseRatingInput = html.find("#defense-rating");
            const modeSelect = html.find("#mode-select");
            const rangeSelect = html.find("#range-select");
            const attackRatingInput = html.find("#attack-rating");
            const damageValueInput = html.find("#damage-value");
            
            const populateWeapons = (actor) => {
                if (actor) {
                    selectedActor = actor;
                    const weapons = actor.items.filter(item => item.type === "weapon");
                    if (weapons.length) {
                        const weaponOptions = weapons.map(weapon => `<option value="${weapon.id}">${weapon.name}</option>`).join("");
                        weaponSelect.html(weaponOptions).prop("disabled", false);
                        weaponSelect.val(weapons[0].id);
                        handleWeaponSelection(weapons[0]);
                    } else {
                        weaponSelect.html("").prop("disabled", true);
                        rangeModeContainer.hide();
                        attributeSelectContainer.hide();
                    }
                }
            };
            
            const handleWeaponSelection = (weapon) => {
                if (weapon.system.category === "range") {
                    rangeModeContainer.show();
                    attributeSelectContainer.hide();
                    
                    const modes = weapon.system.range.modes;
                    const modeOptions = Object.keys(modes)
                    .filter(mode => modes[mode])
                    .map(mode => `<option value="${mode}">${mode.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase())}</option>`)
                    .join("");
                    modeSelect.html(modeOptions);
                    
                    const ranges = weapon.system.range.ranges;
                    const rangeOptions = [
                        { key: "short", label: "Close", value: ranges.short },
                        { key: "medium", label: "Near", value: ranges.medium },
                        { key: "long", label: "Medium", value: ranges.long },
                        { key: "extreme", label: "Far", value: ranges.extreme }
                    ].filter(range => range.value !== null)
                    .map(range => `<option value="${range.key}">${range.label}</option>`)
                    .join("");
                    rangeSelect.html(rangeOptions);
                    
                    attackRatingInput.val(ranges.short);
                    damageValueInput.val(weapon.system.action.damage.base);
                } else if (weapon.system.category === "melee") {
                    rangeModeContainer.hide();
                    attributeSelectContainer.show();
                    const attackRating = selectedActor.system.attributes.agility.value + weapon.system.melee.reach;
                    attackRatingInput.val(attackRating);
                    damageValueInput.val(weapon.system.action.damage.base);
                }
            };
            
            const updateAttackAndDamage = () => {
                const weapon = selectedActor.items.get(weaponSelect.val());
                const selectedRange = rangeSelect.val();
                const selectedMode = modeSelect.val();
                
                if (weapon && weapon.system.category === "range") {
                    const ranges = weapon.system.range.ranges;
                    let attackRating = ranges[selectedRange];
                    let baseDamage = weapon.system.action.damage.base;
                    
                    if (selectedMode === "semi_auto") {
                        attackRating -= 2;
                        baseDamage += 1;
                    } else if (selectedMode === "burst_fire") {
                        attackRating -= 4;
                        baseDamage += 2;
                    } else if (selectedMode === "full_auto") {
                        attackRating -= 6;
                        baseDamage += 3;
                    }
                    
                    attackRatingInput.val(attackRating);
                    damageValueInput.val(baseDamage);
                }
            };
            
            const updateDefenseRating = () => {
                if (targetActor) {
                    const baseDefense = targetActor.system.attributes.body.value;
                    const armorValue = targetActor.system.armor.value || 0;
                    defenseRatingInput.val(baseDefense + armorValue);
                }
            };
            
            html.find("#actor-select").change(event => {
                const actor = game.actors.get(event.target.value);
                populateWeapons(actor);
            });
            
            html.find("#weapon-select").change(event => {
                const weapon = selectedActor.items.get(event.target.value);
                handleWeaponSelection(weapon);
            });
            
            rangeSelect.change(updateAttackAndDamage);
            modeSelect.change(updateAttackAndDamage);
            
            if (selectedActor) populateWeapons(selectedActor);
            updateDefenseRating();
        },
        default: "ok"
    }).render(true);
}

// Function to initialize and render the dropdown selection and roll interface
function openSkillCheckDialog() {
    // Get list of owned actors
    const actors = game.actors.filter(actor => actor.isOwner);
    
    // If only one actor is found, skip the actor dropdown and pre-select it
    const singleActor = actors.length === 1 ? actors[0] : null;
    
    // Dictionaries to store skill and attribute values
    let skillDictionary = {};
    let attributeDictionary = {};
    
    // Helper function to title case attributes
    function titleCase(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // Generate initial content for the dialog
    let content = `<form>`;
    
    // Custom Roll Checkbox
    content += `
    <div class="form-group">
    <label>Custom Roll:</label>
    <input type="checkbox" id="custom-roll-checkbox" />
    </div>`;
    
    // Actor dropdown if there are multiple actors
    if (!singleActor) {
        content += `
        <div class="form-group custom-roll-hidden">
        <label>Actor:</label>
        <select id="actor-select">
        ${actors.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join('')}
        </select>
        </div>`;
    }
    
    // Combined Skills and Attributes dropdown (first dropdown)
    content += `
    <div class="form-group custom-roll-hidden">
    <label>Skill or Attribute:</label>
    <select id="primary-select">
    <option value="">Select a skill or attribute</option>
    </select>
    </div>`;
    
    // Attributes-only dropdown (second dropdown)
    content += `
    <div class="form-group custom-roll-hidden">
    <label>Attribute:</label>
    <select id="secondary-attribute-select">
    <option value="">Select an attribute</option>
    </select>
    </div>`;
    
    // Modifier Text Box
    content += `
    <div class="form-group custom-roll-hidden">
    <label>Modifier:</label>
    <input type="number" id="modifier" value="0" />
    </div>`;
    
    // Manual Dice Pool Input (only shown when custom roll is enabled)
    content += `
    <div class="form-group custom-roll-only" style="display:none;">
    <label>Dice Pool:</label>
    <input type="number" id="custom-dice-pool" value="0" />
    </div>`;
    
    // Checkboxes for "explode", "wild", and "extended"
    content += `
    <div class="form-group">
    <label>Explode:</label>
    <input type="checkbox" id="explode-checkbox" />
    </div>
    <div class="form-group">
    <label>Wild:</label>
    <input type="checkbox" id="wild-checkbox" />
    </div>
    <div class="form-group">
    <label>Extended:</label>
    <input type="checkbox" id="extended-checkbox" />
    </div>`;
    
    // Text box to display the sum of skill, attribute, and modifier values
    content += `
    <div class="form-group custom-roll-hidden">
    <label>Total Dice Pool:</label>
    <input type="text" id="total-value" value="0" readonly />
    </div>
    </form>`;
    
    // Create the dialog box
    const dialog = new Dialog({
        title: "Skill Check",
        content: content,
        buttons: {
            roll: {
                label: "Roll",
                callback: (html) => {
                    const customRoll = html.find('#custom-roll-checkbox').is(':checked');
                    let dicePool;
                    let rollDetails;
                    
                    if (customRoll) {
                        // Use the custom dice pool value for custom rolls
                        dicePool = parseInt(html.find('#custom-dice-pool').val()) || 0;
                        rollDetails = "Custom Roll";
                    } else {
                        // Calculate the dice pool using total and modifier for actor rolls
                        const actorId = singleActor ? singleActor.id : html.find('#actor-select').val();
                        const actor = game.actors.get(actorId);
                        const actorName = actor.name;
                        const skillName = html.find('#primary-select option:selected').text();
                        const attributeName = html.find('#secondary-attribute-select option:selected').text();
                        const modifier = parseInt(html.find('#modifier').val()) || 0;
                        
                        // Calculate wound penalty
                        const stunWounds = actor.system.track.stun.wounds || 0;
                        const physicalWounds = actor.system.track.physical.wounds || 0;
                        const woundPenalty = stunWounds + physicalWounds;
                        
                        // Calculate final dice pool including wound penalty and modifier
                        dicePool = (parseInt(html.find('#total-value').val()) + modifier - woundPenalty) || 0;
                        rollDetails = `${actorName} rolls ${skillName} + ${attributeName} (Mod: ${modifier})`;
                    }
                    
                    // Roll the dice
                    const explode = html.find('#explode-checkbox').is(':checked');
                    const wild = html.find('#wild-checkbox').is(':checked');
                    const extendedTest = html.find('#extended-checkbox').is(':checked');
                    
                    if (extendedTest === true) {
                        let totalHits = 0;
                        let rollCount = 0;
                        let currentDicePool = dicePool;
                        let allRollsLog = [];
                        
                        // Function to handle each roll in the extended test
                        function extendedRoll() {
                            rollCount++;
                            let { result, hits, glitch } = rollDice(currentDicePool, explode, wild);
                            
                            totalHits += hits;
                            
                            // Log current roll for cumulative display
                            allRollsLog.push({
                                rollNumber: rollCount,
                                result: result,
                            });
                            
                            // Build HTML for the table of rolls
                            let rollHistoryRows = allRollsLog.map((log, index) => `
                            <tr>
                            <th>Roll ${index + 1}:</th>
                            <td>${log.result.join(', ')}</td>
                            </tr>
                            `).join('');
                            
                            // Construct message with cumulative roll history and interaction buttons
                            let message = `
                            <h3>Extended Test Roll #${rollCount} for ${rollDetails}</h3>
                            <table>
                            ${rollHistoryRows}
                            <tr>
                            <th>Total Hits</th>
                            <td>${totalHits}</td>
                            </tr>
                            ${glitch ? `
                                <tr>
                                <td colspan="2" style="color: red;">There was a glitch!</td>
                                </tr>` : ''}
                                </table>
                                ${currentDicePool > 1 ? `
                                    <button class="continue-roll">Continue</button>
                                    <button class="stop-roll">Stop</button>` : ``}`;
                                    
                                    // Create chat message and add buttons for interaction
                                    ChatMessage.create({ content: message }).then(chatMessage => {
                                        // Only add hooks if there's more than 1 die left in the pool, and buttons were added to the message
                                        if (currentDicePool > 1) {
                                            Hooks.once('renderChatMessage', (chatMessageHtml, html) => {
                                                if (chatMessage.id === chatMessageHtml.id) {
                                                    // Handle "Continue" button
                                                    html.find(".continue-roll").on("click", function () {
                                                        currentDicePool -= 1; // Reduce dice pool if needed
                                                        chatMessage.delete(); // Remove previous message
                                                        extendedRoll(); // Trigger another roll
                                                    });
                                                    
                                                    // Handle "Stop" button
                                                    html.find(".stop-roll").on("click", function () {
                                                        chatMessage.delete(); // Remove previous message
                                                        
                                                        // Construct final message with cumulative roll history
                                                        const finalMessage = `
                                                        <h3>Final Results for ${rollDetails}</h3>
                                                        <table>
                                                        ${rollHistoryRows}
                                                        <tr>
                                                        <th>Total Hits</th>
                                                        <td>${totalHits}</td>
                                                        </tr>
                                                        </table>`;
                                                        ChatMessage.create({ content: finalMessage });
                                                    });
                                                }
                                            });
                                        }
                                    });
                        }
                        
                        // Start the first roll in the extended test
                        extendedRoll();
                    } else {
                        const { result, hits, glitch } = rollDice(dicePool, explode, wild);
                        
                        // Format the message for chat
                        const message = `
                        <h3>${rollDetails}</h3>
                        <table>
                        <tr>
                        <th>Result</th>
                        <td>
                        ${result.join(' ')}
                        </td>
                        </tr>
                        <tr>
                        <th>Total Hits</th>
                        <td>${hits}</td>
                        </tr>
                        ${glitch ? `
                            <tr>
                            <th colspan="2" style="color:red;">There was a glitch!</th>
                            </tr>` : ``}
                            </table>
                            `;
                            ChatMessage.create({ content: message });
                    }
                }
            },
            cancel: {
                label: "Cancel"
            }
        },
        default: "roll",
            render: (html) => {
                // Toggle custom roll visibility
                function toggleCustomRoll() {
                    const customRollEnabled = html.find('#custom-roll-checkbox').is(':checked');
                    html.find('.custom-roll-hidden').toggle(!customRollEnabled);
                    html.find('.custom-roll-only').toggle(customRollEnabled);
                }
                
                // Function to populate skill and attribute dropdowns based on the selected actor
                function populateOptions(actorId) {
                    const actor = game.actors.get(actorId);
                    
                    // Reset dictionaries
                    skillDictionary = {};
                    attributeDictionary = {};
                    
                    // Populate skills in the dictionary
                    const skills = Object.values(actor.system.skills.active).filter(skill => !skill.hidden);
                    const skillOptions = skills.map(skill => {
                        skillDictionary[skill.name] = skill.base || 0; // Store skill base value
                        return `<option value="${skill.name}">Skill: ${skill.name}</option>`;
                    }).join('');
                    
                    // Base attributes
                    let attributes = ["body", "agility", "reaction", "strength", "willpower", "logic", "intuition", "charisma"];
                    
                    // Check for special attribute additions based on actor's system.special value
                    const specialValue = actor.system.special;
                    if (specialValue === "resonance") {
                        attributes.push("resonance", "submersion");
                    } else if (specialValue === "magic") {
                        attributes.push("magic", "initiation");
                    }
                    
                    // Populate Matrix attributes if matrix rating is greater than 0
                    const matrixRating = actor.system.matrix?.rating || 0;
                    let matrixOptions = "";
                    if (matrixRating > 0) {
                        const matrixAttributes = [
                            { key: "matrixRating", label: "Matrix: Rating", value: matrixRating },
                            { key: "matrixAttack", label: "Matrix: Attack", value: actor.system.matrix.attack?.value || 0 },
                            { key: "matrixSleaze", label: "Matrix: Sleaze", value: actor.system.matrix.sleaze?.value || 0 },
                            { key: "matrixDataProcessing", label: "Matrix: Data Processing", value: actor.system.matrix.data_processing?.value || 0 },
                            { key: "matrixFirewall", label: "Matrix: Firewall", value: actor.system.matrix.firewall?.value || 0 }
                        ];
                        
                        // Add each matrix attribute to the dictionary and the options HTML
                        matrixOptions = matrixAttributes.map(attr => {
                            attributeDictionary[attr.key] = attr.value;
                            return `<option value="${attr.key}">${attr.label}</option>`;
                        }).join('');
                    }
                    
                    // Populate attributes in the dictionary with title casing
                    const attributeOptions = attributes.map(attr => {
                        const titleCasedAttr = titleCase(attr);
                        attributeDictionary[attr] = actor.system.attributes[attr]?.value || 0; // Store attribute value
                        return `<option value="${attr}">Attribute: ${titleCasedAttr}</option>`;
                    }).join('');
                    
                    // Populate the primary select with skills, attributes, and any matrix options
                    html.find('#primary-select').html(`<option value="">Select a skill or attribute</option>` + skillOptions + attributeOptions + matrixOptions);
                    
                    // Populate the secondary attribute select with attributes and matrix options only
                    html.find('#secondary-attribute-select').html(`<option value="">Select an attribute</option>` + attributeOptions + matrixOptions);
                }
                
                // Function to calculate and update the total value
                function updateTotalValue() {
                    const primarySelection = html.find('#primary-select').val();
                    const secondaryAttribute = html.find('#secondary-attribute-select').val();
                    const modifier = parseInt(html.find('#modifier').val()) || 0;
                    
                    // Retrieve the selected skill/attribute and secondary attribute values
                    const primaryValue = skillDictionary[primarySelection] || attributeDictionary[primarySelection] || 0;
                    const secondaryValue = attributeDictionary[secondaryAttribute] || 0;
                    
                    // Calculate total and update the text box
                    const total = primaryValue + secondaryValue + modifier;
                    html.find('#total-value').val(total);
                }
                
                // Toggle visibility based on custom roll checkbox
                html.find('#custom-roll-checkbox').on('change', toggleCustomRoll);
                toggleCustomRoll();  // Initial check on dialog render
                
                // Populate options if only one actor, and set up total value
                if (singleActor) {
                    populateOptions(singleActor.id);
                    updateTotalValue();
                } else {
                    // Update options and total value when actor changes
                    html.find('#actor-select').on('change', function() {
                        populateOptions(this.value);
                        updateTotalValue();
                    });
                    
                    // Populate options and set initial total value for the initial selected actor
                    populateOptions(html.find('#actor-select').val());
                    updateTotalValue();
                }
                
                // Update total value when primary or secondary selections or modifier change
                html.find('#primary-select, #secondary-attribute-select, #modifier').on('change', updateTotalValue);
            }
    });
    
    dialog.render(true);
}

// Expose the key functions for macro usage
game.customMacros = {
    setupCombatDialog,
    openSkillCheckDialog
};
