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
                        <h3>${actor.name} defends using Reaction + Intuition (Mod: ${modifier})</h3>
                        <table>
                            <tr>
                                <th>Result</th>
                                <td>
                                  ${defenseResult.result.map(value => {
                                    let color = '';
                                    if (value === 1) color = 'red';
                                    else if (value === 5 || value === 6) color = 'green';
                                    return `<span style="color: ${color};">${value}</span>`;
                                  }).join(', ')}
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
                        <h3>${actor.name} soaks using Body (Mod: ${modifier})</h3>
                        <table>
                            <tr>
                                <th>Result</th>
                                <td>
                                  ${soakResult.result.map(value => {
                                    let color = '';
                                    if (value === 1) color = 'red';
                                    else if (value === 5 || value === 6) color = 'green';
                                    return `<span style="color: ${color};">${value}</span>`;
                                  }).join(', ')}
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

// Combat Setup Function (formerly macro)
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
                        
                        // Open a new dialog with additional options
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
                                                          ${rollResult.result.map(value => {
                                                            let color = '';
                                                            if (value === 1) color = 'red';
                                                            else if (value === 5 || value === 6) color = 'green';
                                                            return `<span style="color: ${color};">${value}</span>`;
                                                          }).join(', ')}
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

// Expose the setupCombatDialog function for use within Foundry's macro interface
Hooks.once('ready', () => {
    game.shadowrunDiceRoller = { setupCombatDialog };
});

// Function to initialize and render the dropdown selection and roll interface
function openSkillCheckDialog() {
    const ownedActors = game.actors.filter(actor => actor.type === "character" && actor.isOwner);

    if (ownedActors.length === 0) {
        ui.notifications.warn("You don't own any characters to select.");
        return;
    }

    const singleActor = ownedActors.length === 1;
    const selectedActor = singleActor ? ownedActors[0] : null;

    const actorOptions = singleActor
        ? ""
        : ownedActors.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join('');

    const content = `
    <form>
    ${!singleActor ? `
        <div class="form-group" id="actorSelectContainer">
        <label for="actorSelect">Select Actor:</label>
        <select id="actorSelect">${actorOptions}</select>
        </div>
        ` : ""}
        <div class="form-group" id="skillSelectContainer">
        <label for="skillSelect">Select Skill or Attribute:</label>
        <select id="skillSelect"></select>
        </div>
        <div class="form-group" id="attributeSelectContainer">
        <label for="attributeSelect">Select Attribute:</label>
        <select id="attributeSelect"></select>
        </div>
        <div class="form-group" id="modifierContainer">
        <label for="modifier">Modifier:</label>
        <input type="number" id="modifier" value="0" />
        </div>
        <div class="form-group">
        <label for="wildDie">Wild Die:</label>
        <input type="checkbox" id="wildDie" />
        </div>
        <div class="form-group">
        <label for="explodeSixes">Explode 6s:</label>
        <input type="checkbox" id="explodeSixes" />
        </div>
        <div class="form-group">
        <label for="extendedTest">Extended Test:</label>
        <input type="checkbox" id="extendedTest" />
        </div>
        <div class="form-group">
        <label for="customRoll">Custom Roll:</label>
        <input type="checkbox" id="customRoll" />
        </div>
        <div class="form-group" id="customDiceContainer" style="display: none;">
        <label for="customDice">Number of Dice to Roll:</label>
        <input type="number" id="customDice" value="0" />
        </div>
        <div class="form-group" id="skillInfoContainer">
        <label for="skillInfo">Skill + Attribute Info:</label>
        <input type="text" id="skillInfo" readonly />
        </div>
    </form>`;

    new Dialog({
        title: "Select Actor and Skill",
        content: content,
        buttons: {
            ok: {
                label: "Roll",
                callback: (html) => {
                    const customRoll = html.find("#customRoll").is(":checked");
                    let dicePool = customRoll ? parseInt(html.find("#customDice").val()) || 0 : parseInt(html.find("#skillInfo").val().match(/\((\d+)d6\)/)[1], 10);
                    const selectedActorId = html.find("#actorSelect").val() || (singleActor ? ownedActors[0].id : null);
                    const actorName = game.actors.get(selectedActorId).name;
                    const skillName = customRoll ? "Custom" : html.find("#skillSelect option:selected").text();
                    const attributeName = customRoll ? "" : html.find("#attributeSelect option:selected").text();
                    const modifier = parseInt(html.find("#modifier").val()) || 0;
                    const useWildDie = html.find("#wildDie").is(":checked");
                    const explodeSixes = html.find("#explodeSixes").is(":checked");

                    // Perform roll using rollDice function
                    const { result, hits, glitch } = rollDice(dicePool, explodeSixes, useWildDie);

                    // Display the result message in chat
                    const message = `
                        <h3>${actorName} defends using ${skillName} + ${attributeName} (Mod: ${modifier})</h3>
                        <table>
                            <tr>
                                <th>Result</th>
                                <td>
                                  ${result.map(value => {
                                    let color = '';
                                    if (value === 1) color = 'red';
                                    else if (value === 5 || value === 6) color = 'green';
                                    return `<span style="color: ${color};">${value}</span>`;
                                  }).join(', ')}
                                </td>
                            </tr>
                            <tr>
                                <th>Total Hits</th>
                                <td>${hits}</td>
                            </tr>
                            ${glitch === true ? `
                            <tr>
                                There was a glitch!
                            </tr>` : ``}
                        </table>
                    `;
                    ChatMessage.create({ content: message });
                }
            },
            cancel: { label: "Cancel" }
        },
        default: "ok",
        render: (html) => {
            loadActorData(singleActor ? ownedActors[0].id : html.find("#actorSelect").val(), html);
            // Dynamic updates
            html.find("#customRoll").on("change", function () {
                if (this.checked) {
                    html.find("#skillSelectContainer, #attributeSelectContainer, #modifierContainer, #skillInfoContainer").hide();
                    html.find("#customDiceContainer").show();
                } else {
                    html.find("#skillSelectContainer, #attributeSelectContainer, #modifierContainer, #skillInfoContainer").show();
                    html.find("#customDiceContainer").hide();
                }
            });
        }
    }).render(true);
}
