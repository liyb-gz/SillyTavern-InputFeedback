// The main script for the extension
// The following are examples of some basic extension functionality

//You'll likely need to import extension_settings, getContext, and loadExtensionSettings from extensions.js
import {
  extension_settings,
  getContext,
  loadExtensionSettings,
} from "../../../extensions.js";

//You'll likely need to import some other functions from the main script
import {
  saveSettingsDebounced,
  eventSource,
  event_types,
} from "../../../../script.js";

eventSource.on(event_types.MESSAGE_EDITED, handleMessageEdited);
eventSource.on(event_types.USER_MESSAGE_RENDERED, handleUserMessageRendered);
eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);

// Related events
// MESSAGE_SENT
// MESSAGE_EDITED
// CHAT_CHANGED - load feedback
// Refer to plugin: translate
// TODO: move event triggers to the main script

const context = getContext();

function handleMessageEdited(messageId) {
  console.log("[InputFeedback] Message edited triggered. id: ", messageId);
  console.log("[InputFeedback] message: ", context.chat[messageId]);
}

function handleUserMessageRendered(messageId) {
  console.log("[InputFeedback] User message rendered. id: ", messageId);
  console.log("[InputFeedback] message: ", context.chat[messageId]);
  $(`.mes[mesid="${messageId}"] .mes_block`).append(
    `<div class="input-feedback">Input feedback</div>`
  );
}

function handleChatChanged() {
  console.log("[InputFeedback] Chat changed");
}

// Keep track of where your extension is located, name should match repo name
const extensionName = "SillyTavern-InputFeedback";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Updating settings in the UI
  $("#example_setting")
    .prop("checked", extension_settings[extensionName].example_setting)
    .trigger("input");
}

// This function is called when the extension settings are changed in the UI
function onExampleInput(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].example_setting = value;
  saveSettingsDebounced();
}

// This function is called when the button is clicked
function onButtonClick() {
  // You can do whatever you want here
  // Let's make a popup appear with the checked setting
  toastr.info(
    `The checkbox is ${
      extension_settings[extensionName].example_setting
        ? "checked"
        : "not checked"
    }`,
    "A popup appeared because you clicked the button!"
  );
}

// This function is called when the extension is loaded
jQuery(async () => {
  // This is an example of loading HTML from a file
  const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);

  // Append settingsHtml to extensions_settings
  // extension_settings and extensions_settings2 are the left and right columns of the settings menu
  // Left should be extensions that deal with system functions and right should be visual/UI related
  $("#extensions_settings2").append(settingsHtml);

  // These are examples of listening for events
  $("#my_button").on("click", onButtonClick);
  $("#example_setting").on("input", onExampleInput);

  // Load settings when starting things up (if you have any)
  loadSettings();
});
