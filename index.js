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

// Keep track of where your extension is located, name should match repo name
const extensionName = "SillyTavern-InputFeedback";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

// Related events
// MESSAGE_SENT - get feedback
// MESSAGE_EDITED - get feedback
// USER_MESSAGE_RENDERED - render feedback
// maybe rendering should not happen in handleUserMessageRendered, but after getting result from llm
// CHAT_CHANGED - load feedback

// Actually, may need to load more input feedback when "show more messages" is clicked, but no event for that yet;
// but its less urgent, as older language feedback is less useful

// Refer to plugin: translate, memory (summarize)
// TODO: add settings: language, prompt
// TODO: add feedback interface
// TODO: write feedback to chat file
// TODO: actually get feedback from llm
// TODO: remove blue backgroud
// TODO: display: use other method than .append

// The main script for the extension
// The following are examples of some basic extension functionality

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function displayFeedback(messageId, messageStr) {
  console.log("[InputFeedback] displayFeedback");
  let feedbackDiv = $(`.mes[mesid="${messageId}"] .mes_block .input-feedback`);
  if (feedbackDiv.length) {
    // If the div already exists, replace its content
    feedbackDiv.html(messageStr);
  } else {
    // If the div doesn't exist, create it
    $(`.mes[mesid="${messageId}"] .mes_block`).append(
      `<div class="input-feedback">${messageStr}</div>`
    );
  }
}

async function getFeedback(messageId, message) {
  if (typeof message.extra !== "object") {
    message.extra = {};
  }

  await timeout(2000);

  message.extra.inputFeedback = {
    message: message.mes,
    feedback: `Input feedback - ${new Date().toLocaleString()}`,
  };

  displayFeedback(messageId, message.extra.inputFeedback.feedback);
}

function handleMessageEdited(messageId) {
  const context = getContext();
  const message = context.chat[messageId];

  if (message?.is_user) {
    getFeedback(messageId, message);
  }

  console.log("[InputFeedback] Message edited triggered. id: ", messageId);
  console.log("[InputFeedback] message: ", message);
}

function handleMessageSent(messageId) {
  const context = getContext();
  const message = context.chat[messageId];

  if (message.is_user) {
    getFeedback(messageId, message);
  }

  console.log("[InputFeedback] Message sent triggered. id: ", messageId);
  console.log("[InputFeedback] message: ", message);
}

function handleChatChanged() {
  const context = getContext();
  console.log("[InputFeedback] Chat changed");
  const messages = context.chat;
  console.log("[InputFeedback] messages:", messages);
  messages.forEach((message, index) => {
    if (message.is_user && message.extra?.inputFeedback) {
      displayFeedback(index, message.extra?.inputFeedback.feedback);
    }
  });
}

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

  // Register event listeners
  eventSource.on(event_types.MESSAGE_EDITED, handleMessageEdited);
  eventSource.on(event_types.MESSAGE_SENT, handleMessageSent);
  eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);
});
