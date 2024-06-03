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
  generateRaw,
  messageFormatting,
} from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "SillyTavern-InputFeedback";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {};

// Related events
// MESSAGE_SENT - get feedback
// MESSAGE_EDITED - get feedback
// CHAT_CHANGED - load feedback

// Actually, may need to load more input feedback when "show more messages" is clicked, but no event for that yet;
// but its less urgent, as older language feedback is less useful

// Refer to plugin: translate, memory (summarize)
/* TODO: add settings
    options:
    -   prompt,
    -   template,
    -   enabled,
    -   number of previous messages
    -   feedback default folding
 */
// TODO: take prompt from settings
// TODO: add feedback waiting animation
// TODO: add feedback icon to new messages
// TODO: delete a feedback
// TODO: purge feedback
// TODO: i18n

// The main script for the extension

function getMessage(messageId) {
  const context = getContext();
  return context.chat[messageId];
}

function drawer(content, expended = false) {
  const direction = expended ? "up" : "down";
  const html = `
  <div class="inline-drawer input-feedback content">
    <div class="inline-drawer-toggle inline-drawer-header">
      <span data-i18n="[title]Input Feedback">Input Feedback</span>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-${direction} ${direction}"></div>
    </div>
    <div class="inline-drawer-content" ${
      expended && `style="display:block"`
    }>${messageFormatting(content)}</div>
  </div>`;

  return html;
}

function showLoading(messageId) {
  console.log("[InputFeedback] showLoading:", messageId);
  // Display loading indicator
  const loadingIndicator = `
  <div class="inline-drawer input-feedback loading-indicator">
    <div class="inline-drawer-header">
      <div class="inline-drawer-icon fa-solid fa-spell-check fa-beat-fade"></div>
    </div>
  </div>`;
  $(`.mes[mesid="${messageId}"] .mes_block`).append(loadingIndicator);

  // Hide feedback content
  $(`.mes[mesid="${messageId}"] .mes_block .input-feedback.content`).hide();
}

function hideLoading(messageId) {
  // Remove loading indicator
  $(`.mes[mesid="${messageId}"] .mes_block .loading-indicator`).remove();

  // Show feedback content
  $(`.mes[mesid="${messageId}"] .mes_block .input-feedback.content`).show();
}

function displayFeedback(messageId) {
  const message = getMessage(messageId);

  const feedbackDiv = $(
    `.mes[mesid="${messageId}"] .mes_block .input-feedback.content`
  );
  const feedback = message?.extra?.inputFeedback?.feedback;

  if (feedbackDiv.length) {
    // If the div already exists, replace its content
    feedbackDiv.replaceWith(drawer(feedback));
  } else {
    // If the div doesn't exist, create it
    $(`.mes[mesid="${messageId}"] .mes_block`).append(drawer(feedback));
  }
}

function addFeedbackButton(messageId) {
  $(`.mes[mesid=${messageId}] .mes_block .extraMesButtons`).append(
    `<div title="Request Feedback" class="mes_feedback fa-solid fa-spell-check" data-i18n="[title]Request Feedback"></div>`
  );
}

function getPreviousMessages(messageId, numberOfPreviousMessages) {
  const previousMessages = [];
  for (
    let i = messageId - 1;
    i >= 0 && i >= messageId - numberOfPreviousMessages;
    i--
  ) {
    const message = getMessage(i);
    const messageStr = `${message.name}: ${message.mes}`;
    previousMessages.unshift(messageStr);
  }
  return previousMessages.join("\n\n");
}

async function getFeedback(messageId) {
  const numberOfPreviousMessages = 5;
  const feedbackPrompt =
    "上記の文について、文法と自然さを検証し、フィードバックをお願いします。問題がない場合は、「問題ありません」とだけ記載してください。その後、訂正された文を提供してください。その際、文の丁寧さと調子を変えないでください、ロールプレイの途中にありますから。";

  const message = getMessage(messageId);

  if (typeof message.extra !== "object") {
    message.extra = {};
  }

  const template = `
    Previous Messages:
    {{previousMessages}}

    Current Message:
    {{message}}

    ---

    {{prompt}}
  `;

  const previousMessages = getPreviousMessages(
    messageId,
    numberOfPreviousMessages
  );

  const prompt = template
    .replace(/{{previousMessages}}/i, previousMessages ?? "None")
    .replace(/{{message}}/i, message.mes)
    .replace(/{{prompt}}/i, feedbackPrompt);

  showLoading(messageId);
  const feedback = await generateRaw(prompt, null, false, true);
  hideLoading(messageId);

  message.extra.inputFeedback = {
    // Save the original message for comparison later
    message: message.mes,
    feedback,
  };

  displayFeedback(messageId, message.extra.inputFeedback.feedback);
}

function handleMessageEdited(messageId) {
  const message = getMessage(messageId);

  // only initiate feedback if the message has changed
  if (
    message?.is_user &&
    message.extra?.inputFeedback.message !== message.mes
  ) {
    getFeedback(messageId);
  }

  console.log("[InputFeedback] Message edited triggered. id: ", messageId);
  console.log("[InputFeedback] message: ", message);
}

function handleUserMessageRendered(messageId) {
  const message = getMessage(messageId);

  if (message.is_user) {
    getFeedback(messageId);
  }

  console.log("[InputFeedback] Message sent triggered. id: ", messageId);
  console.log("[InputFeedback] message: ", message);
}

function handleChatChanged() {
  const context = getContext();
  console.log("[InputFeedback] Chat changed");
  const messages = context.chat;
  console.log("[InputFeedback] messages:", messages);
  messages.forEach((message, messageId) => {
    if (message.is_user && message.extra?.inputFeedback) {
      addFeedbackButton(messageId);
      displayFeedback(messageId, message.extra?.inputFeedback.feedback);
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
  // Loading settings html
  const settingsHtml = await $.get(`${extensionFolderPath}/setting.html`);

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
  eventSource.on(event_types.USER_MESSAGE_RENDERED, handleUserMessageRendered);
  eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);

  // Add feedback button to existing messages to trigger a feedback request
  $(document).on("click", ".mes_feedback", function () {
    const messageBlock = $(this).closest(".mes");
    const messageId = Number(messageBlock.attr("mesid"));
    getFeedback(messageId);
  });
});
