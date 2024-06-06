import { _log } from './logging.js';
import { moduleName } from './settings.js';
import {
    compendiumInfoFromString, drawTableItem,
    drawTableText, findCompendiumItem,
  } from './compendium.js'

export class SettingsForm extends FormApplication {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            id: "cairn-creator-settings-form",
            title: "Cairn Character Creator Settings",
            template: `modules/${moduleName}/templates/forms/Settings.html`,
            width: 680
        });
    }
  
    // Return the data for the form
    getData() {
        // Fetch all Compendiums metadata only (lazy loading content later)
        const packs = game.packs.map(p => ({
            label: p.metadata.label,
            value: p.collection
        }));

        // Sort packs alphabetically by title
        packs.sort((a, b) => a.label.localeCompare(b.label));

        _log("Fetched compendium metadata: ", packs);
        const currentOptions = game.settings.get(moduleName, "character-creation-options");
        const currentTraits = game.settings.get(moduleName, "character-traits");

        return {
            options: {
                compendiums: packs,
                currentOptions,
                currentTraits
            }
        };
    }

    // Form validation
    async _onSubmit(event, { preventClose, preventRender } = {}) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);
        
        const validateOptions = [
            'Names',
            'Starting Gear - Armor',
            'Starting Gear - Bonus Item',
            'Starting Gear - Bonus Item - Armor or Weapon',
            'Starting Gear - Bonus Item - Tool or Trinket',
            'Starting Gear - Expeditionary Gear',
            'Starting Gear - Helmet & Shields',
            'Starting Gear - Helmets',
            'Starting Gear - Spellbooks',
            'Starting Gear - Tools',
            'Starting Gear - Trinkets',
            'Starting Gear - Weapons',
            'Starting Gear - Weapons - One-Handed Melee',
            'Starting Gear - Weapons - Ranged',
            'Starting Gear - Weapons - Simple',
            'Starting Gear - Weapons - Two-Handed Melee'
        ]
        const validateTraits = [
            'Background',
            'Clothing',
            'Face',
            'Female Names',
            'Hair',
            'Male Names',
            'Misfortunes',
            'Physique',
            'Reputation',
            'Skin',
            'Speech',
            'Surnames',
            'Vice',
            'Virtue'
        ]

        const packs = game.packs.map(p => ({
            label: p.metadata.label,
            value: p.collection
        }));

        const ccOptions = formData.get("ccoptions");
        const traits = formData.get("ctraits");

        // Validate that the selected pack contains all required tables
        const ccpack = game.packs.get(ccOptions);
        
        if (!ccpack) {
            ui.notifications.error("Selected pack for character creation options not found.");
            return;
        }

        // Load the pack's index (metadata of entries)
        const ccpackIndex = await ccpack.getIndex();
        const ccpackEntryNames = ccpackIndex.map(entry => entry.name);

        // Check if all validateOptions exist in the pack entries
        const ccmissingOptions = validateOptions.filter(option => !ccpackEntryNames.includes(option));
        if (ccmissingOptions.length > 0) {
            ui.notifications.error(`The selected character creation pack is missing the following required tables: ${ccmissingOptions.join(', ')}`);
            return;
        }

        const tpack = game.packs.get(traits);
        if (!tpack) {
            ui.notifications.error("Selected pack for character creation options not found.");
            return;
        }

        // Load the pack's index (metadata of entries)
        const tpackIndex = await tpack.getIndex();
        const tpackEntryNames = tpackIndex.map(entry => entry.name);

        // Check if all validateOptions exist in the pack entries
        const tmissingOptions = validateTraits.filter(option => !tpackEntryNames.includes(option));
        if (tmissingOptions.length > 0) {
            ui.notifications.error(`The selected traits pack is missing the following required tables: ${tmissingOptions.join(', ')}`);
            return;
        }

        // If validation passes, call the parent class's _onSubmit method
        return super._onSubmit(event, { preventClose, preventRender });
    }
  
    // Handle form submission
    async _updateObject(event, formData) {
        await game.settings.set(moduleName, "character-creation-options", formData.ccoptions);
        await game.settings.set(moduleName, "character-traits", formData.ctraits);
        ui.notifications.info("Settings saved successfully.");
    }
}

export const createCharacter = async () => createActorWithCharacter(await _generateCharacter());

export const regenerateActor = async (actor)  => updateActorWithCharacter(actor, await _generateCharacter());


export const createActorWithCharacter = async (characterData) => {
    const data = await characterToActorData(characterData);
    _log('Character Promise Data: ', data)
    return Actor.create(data);
};


const updateActorWithCharacter = async (actor, characterData) => {
    _log(actor);
    const data = await characterToActorData(characterData);
    await actor.deleteEmbeddedDocuments("Item", [], {
      deleteAll: true,
      render: false,
    });
    await actor.update(data);
    for (const token of actor.getActiveTokens()) {
      await token.document.update({
        img: actor.img,
        name: actor.name,
      });
    }
    return actor;
};
  

async function _generateCharacter() {
    _log('Generating character...')
    const characterGenerator = CONFIG.Cairn.characterGenerator;
    const newOptions = game.settings.get(moduleName, "character-creation-options");
    const newTraits = game.settings.get(moduleName, "character-traits");
    _log('New Options', newOptions);
    _log('New Traits', newTraits);
    _log(characterGenerator)
    const abilities = await rollAbilities(characterGenerator.ability);
    const hp = await rollHitProtection(characterGenerator.hitProtection);
    const gold = await rollGold(characterGenerator.gold);

    const charNameGen = {
        text: "{name} {surname}",
        items: {
            name: `${newOptions};Names`,
            surname: `${newTraits};Surnames`
        }
    }
    const name = await rollName(charNameGen);

    const charBioGen = {
        age: characterGenerator.biography.age,
        text: characterGenerator.biography.text,
        items: {
            clothing: `${newTraits};Clothing`,
            face: `${newTraits};Face`,
            hair: `${newTraits};Hair`,
            misfortune: `${newTraits};Misfortunes`,
            physique: `${newTraits};Physique`,
            reputation: `${newTraits};Reputation`,
            skin: `${newTraits};Skin`,
            speech: `${newTraits};Speech`,
            vice: `${newTraits};Vice`,
            virtue: `${newTraits};Virtue`
        }
    }
    const biography = await rollBiography(charBioGen);

    const background = await rollBackground(`${newTraits};Background`)
    const startingItems = await findStartingItems(characterGenerator.startingItems);
    const startingGear = await rollStartingGear([
        `${newOptions};Starting Gear - Armor`,
        `${newOptions};Starting Gear - Helmet & Shields`,
        `${newOptions};Starting Gear - Weapons`,
        `${newOptions};Starting Gear - Expeditionary Gear`,
        `${newOptions};Starting Gear - Tools`,
        `${newOptions};Starting Gear - Trinkets`,
        `${newOptions};Starting Gear - Bonus Item`
    ]);

    return {
        name,
        hp,
        gold,
        abilities,
        background,
        items: [...startingItems, ...startingGear],
        biography
    };
}

const evaluateFormula = async (formula, data) => {
    const roll = new Roll(formula, data);
    return roll.evaluate({ async: true });
};

const formatString = (str, data = {}) => {
    const fmt = /\{[^}]+\}/g;
    str = str.replace(fmt, k => {
        return data[k.slice(1, -1)];
    });
    return str;
}

const rollTextItems = async (items) => {
    const data = {};
    for (const [key, value] of Object.entries(items)) {
        const [compendium, table] = compendiumInfoFromString(value)
        data[key] = await drawTableText(compendium, table);
    }
    return data;
};

const rollItems = async (items) => {
    const result = [];
    for (const value of Object.values(items)) {
      const [compendium, table] = compendiumInfoFromString(value)
      result.push(await drawTableItem(compendium, table));
    }
    return result.flatMap(item => duplicate(item));
};

const rollAbilities = async (formula) => ({
    STR: (await evaluateFormula(formula)).total,
    DEX: (await evaluateFormula(formula)).total,
    WIL: (await evaluateFormula(formula)).total
});

const rollHitProtection = async (formula) => (await evaluateFormula(formula)).total;

const rollGold = async (formula) => (await evaluateFormula(formula)).total;

const rollAge = async (formula) => (await evaluateFormula(formula)).total;

const rollName = async (config) => formatString(config.text, await rollTextItems(config.items));

const rollBiography = async (config) => formatString(config.text,{
    age: await rollAge(config.age),
    ...await rollTextItems(config.items)
});

const rollBackground = async (config) => drawTableText(...compendiumInfoFromString(config));

const rollStartingGear = async (items) => rollItems(items);

const findStartingItems = async (items) => {
    const result = [];
    for (const compendiumItem of items) {
      const [compendium, table, quantity = 1] = compendiumInfoFromString(compendiumItem);
  
      const item = duplicate(await findCompendiumItem(compendium, table));
  
      item.system.quantity = parseInt(quantity, 10);
  
      result.push(item);
    }
    return result;
};

async function characterToActorData(characterData) {
    return {
        name: characterData.name,
        system: {
        abilities: {
            STR: { value: characterData.abilities.STR, max: characterData.abilities.STR },
            DEX: { value: characterData.abilities.DEX, max: characterData.abilities.DEX },
            WIL: { value: characterData.abilities.WIL, max: characterData.abilities.WIL },
        },
        hp: {
            max: characterData.hp,
            value: characterData.hp,
        },
        background: characterData.background,
        biography: characterData.biography,
        gold: characterData.gold,
        },
        items: characterData.items,
        token: {
        name: characterData.name,
        disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        actorLink: true,
        vision: true,
        },
        type: "character"
    }
};