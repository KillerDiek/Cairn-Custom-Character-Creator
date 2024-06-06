import { moduleName } from './settings.js';
import { createCharacter, regenerateActor, SettingsForm } from './characterGenerator.js';
import { _log } from './logging.js';
import { preloadTemplates } from './preloadTemplates.js';


// Register the settings and the custom form application to be accessible
Hooks.once('init', async () => {
    await preloadTemplates();
    
    game.settings.register(moduleName, 'devMode', {
        name: 'Developer Mode',
        hint: 'Enable this to log additional debug information to the console.',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });
    game.settings.register(moduleName, "character-creation-options", {
        name: "Character Creation Options",
        hint: "Choose the compendium with character tables.",
        scope: "world",
        config: false,
        type: String,
        default: ""
    });
    game.settings.register(moduleName, 'character-traits', {
        name: 'Character Traits',
        hint: 'Choose the compendium with character traits.',
        scope: 'world',
        config: false,
        type: String,
        default: ""
    });
    console.log("Cairn Custom Character Creator settings registered");
});

Hooks.once('ready', async function() {
    if (game.user.isGM) {
        // Add a settings button to the module settings
        game.settings.registerMenu(moduleName, "settingsMenu", {
            name: "Settings",
            label: "Cairn Custom Character Creator Settings",
            hint: "Configure the settings for compendiums.",
            icon: "fas fa-cogs",
            type: SettingsForm,
            restricted: true
        });
    }
});
  

// Add Custom Character button
Hooks.on('renderActorDirectory', async (ActorDirectory, html, css) => {
    _log("Cairn Custom Character Creator Loaded!");
    if (game.user.can("ACTOR_CREATE")) {
        let dirHead = html.find('.character-generator')
        let tableActions = dirHead.find('.header-actions')
        if (!tableActions.find('.cairn-character-creator').length) {
            tableActions.append(`<button type='button' class='cairn-character-creator'><i class='fa-solid fa-person'></i> Custom Character</button>`);
            html.on('click', '.cairn-character-creator', async (event) => {
                await createCharacter();
            });
        }
    }
});

Hooks.on('getActorSheetHeaderButtons', async (ActorSheet, actions) => {
    _log("Custom Regenerator Loaded!");
    // Ensure we only modify the sheet we want
    if (ActorSheet.actor.type === 'character') {
        // Create the button
        const button = {
            label: 'Custom Regenerate',
            class: 'custom-regenerate',
            icon: 'fa-solid fa-person',
            onclick: () => {
                // Define what the button should do when clicked
                Dialog.confirm({
                    title: "Regenerate Character",
                    content: "Do you want to regenerate your character?",
                    yes: (html) => { regenerateActor(ActorSheet.object) },
                    no: (html) => { return null; },
                  });
            }
        };
        
        // Add the button object to the beginning of the actions array
        actions.unshift(button);
        
        _log(actions);
        
        // Return the modified actions array
        return [ActorSheet, actions];
    }
});