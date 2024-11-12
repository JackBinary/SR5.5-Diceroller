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

                    // Calculate damage
                    let damage = dv + netHits;

                    // Display defense test results
                    const defenseTable = `
                        <table>
                            <tr><th>Defense Test Hits</th><td>${defenseHits}</td></tr>
                            <tr><th>Net Hits</th><td>${netHits}</td></tr>
                            <tr><th>Damage</th><td>${damage}</td></tr>
                        </table>
                    `;
                    ChatMessage.create({ content: defenseTable });

                    // Proceed to Soak Test
                    handleSoakTest(damage, actor);
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
// Add button to chat message for defense test
Hooks.on("renderChatMessage", (message, html) => {
    if (message.data.flags["shadowrun-defense-test"]?.defenseButton) {
        const button = $(`<button>Defense Test</button>`);
        button.on("click", () => {
            const { hits, dv, actorId } = message.data.flags["shadowrun-defense-test"];
            handleDefenseTest(hits, dv, actorId);
        });
        html.find(".message-content").append(button);
    }
});
