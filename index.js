import {
  extension_settings,
  getContext,
  loadExtensionSettings,
} from "../../../extensions.js";

import {
  saveSettingsDebounced,
  saveChatDebounced,
  eventSource,
  event_types,
  generateRaw,
  messageFormatting,
  getCurrentChatId,
} from "../../../../script.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "SillyTavern-InputFeedback";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const extensionSettings = extension_settings[extensionName];
const defaultSettings = {
  enabled: true,
  autoNew: false,
  autoEdit: false,
  folded: false,
  template: `Previous Messages:
{{previousMessages}}

Current Message:
{{message}}

---

{{prompt}}`,
  prompt:
    "Please check the message above regarding grammar and naturalness, and provide corresponding feedbacks. After that, please provide the corrected sentence. Do not change the politeness and tone of the sentence, as it is in the middle of a role play. If you didn't find a problem, please just state “This message looks good.” without any other comments.",
  numPrevMsgs: 5,
  numPrevMsgsMin: 0,
  numPrevMsgsMax: 20,
  numPrevMsgsStep: 1,
};

// Related events
// MESSAGE_SENT - get feedback
// MESSAGE_EDITED - get feedback
// CHAT_CHANGED - load feedback

// Actually, may need to load more input feedback when "show more messages" is clicked, but no event for that yet;
// but its less urgent, as older language feedback is less useful

// Refer to plugin: translate, memory (summarize)
// TODO: i18n
// TODO: slash command to request feedback
// TODO: slash command to remove feedback
// TODO: (?) slash command to request feedback for all messages

// The main script for the extension

// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
  //Create the settings if they don't exist
  extension_settings[extensionName] = extension_settings[extensionName] || {};
  if (Object.keys(extension_settings[extensionName]).length === 0) {
    Object.assign(extension_settings[extensionName], defaultSettings);
  }

  // Updating settings in the UI
  $("#input-feedback-enabled")
    .prop("checked", extension_settings[extensionName].enabled)
    .trigger("input");
  $("#input-feedback-auto-new")
    .prop("checked", extension_settings[extensionName].autoNew)
    .trigger("input");
  $("#input-feedback-auto-edit")
    .prop("checked", extension_settings[extensionName].autoEdit)
    .trigger("input");
  $("#input-feedback-folded")
    .prop("checked", extension_settings[extensionName].folded)
    .trigger("input");
  $("#input-feedback-template")
    .val(extension_settings[extensionName].template)
    .trigger("input");
  $("#input-feedback-prompt")
    .val(extension_settings[extensionName].prompt)
    .trigger("input");
  $("#input-feedback-num-prev-msgs")
    .val(extension_settings[extensionName].numPrevMsgs)
    .trigger("input");
}

function getMessage(messageId) {
  const context = getContext();
  return context.chat[messageId];
}

function getPreviousMessages(messageId, numPrevMsgs) {
  const previousMessages = [];
  for (let i = messageId - 1; i >= 0 && i >= messageId - numPrevMsgs; i--) {
    const message = getMessage(i);
    const messageStr = `${message.name}: ${message.mes}`;
    previousMessages.unshift(messageStr);
  }
  return previousMessages.join("\n\n");
}

async function getFeedback(messageId) {
  const { numPrevMsgs, prompt: feedbackPrompt, template } = extensionSettings;
  const message = getMessage(messageId);

  if (typeof message.extra !== "object") {
    message.extra = {};
  }

  const previousMessages = getPreviousMessages(messageId, numPrevMsgs);

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

  saveChatDebounced();
  displayFeedback(messageId, message.extra.inputFeedback.feedback);
}

function deleteMessage(messageId) {
  // Remove feedback from the file
  const message = getMessage(messageId);
  delete message.extra.inputFeedback;
  saveChatDebounced();

  // Remove feedback from interface
  $(`.mes[mesid="${messageId}"] .mes_block .input-feedback.content`).remove();
}

function handleMessageEdited(messageId) {
  // Only trigger feedback if auto is enabled
  if (!extensionSettings.enabled || !extensionSettings.autoEdit) {
    return;
  }

  const message = getMessage(messageId);

  // only initiate feedback if the message has changed
  if (
    message?.is_user &&
    message.extra?.inputFeedback &&
    message.extra.inputFeedback.message !== message.mes
  ) {
    getFeedback(messageId);
  }

  console.log("[InputFeedback] Message edited triggered. id: ", messageId);
}

function handleUserMessageRendered(messageId) {
  if (!extensionSettings.enabled) {
    return;
  }

  addFeedbackButton(messageId);

  // Only trigger feedback if auto is enabled
  if (!extensionSettings.autoNew) {
    return;
  }

  getFeedback(messageId);

  console.log("[InputFeedback] Message sent triggered. id: ", messageId);
}

function handleChatChanged() {
  if (!extensionSettings.enabled) {
    return;
  }

  const context = getContext();
  console.log("[InputFeedback] Chat changed");
  const messages = context.chat;
  messages.forEach((message, messageId) => {
    if (message.is_user) {
      addFeedbackButton(messageId);

      if (message.extra?.inputFeedback) {
        displayFeedback(messageId, message.extra.inputFeedback.feedback);
      }
    }
  });
}

function onEnabledInput(event) {
  const enabled = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].enabled = enabled;
  saveSettingsDebounced();

  if (!enabled) {
    // Remove feedback button and drawer if the extension is disabled
    $(".mes_feedback").remove();
    $(".input-feedback.content").remove();
  } else {
    // Add feedback button to existing messages if the extension is enabled
    handleChatChanged();
  }
}

function onAutoNewInput(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].autoNew = value;
  saveSettingsDebounced();
}

function onAutoEditInput(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].autoEdit = value;
  saveSettingsDebounced();
}

function onFoldedInput(event) {
  const value = Boolean($(event.target).prop("checked"));
  extension_settings[extensionName].folded = value;
  saveSettingsDebounced();
}

function onTemplateInput() {
  const value = $(this).val();
  extension_settings[extensionName].template = value;
  saveSettingsDebounced();
}

function onPromptInput() {
  const value = $(this).val();
  extension_settings[extensionName].prompt = value;
  saveSettingsDebounced();
}

function onNumPrevMsgsInput() {
  const value = $(this).val();
  extension_settings[extensionName].numPrevMsgs = Number(value);
  $("#input-feedback-num-prev-msgs_value").html(
    extension_settings[extensionName].numPrevMsgs
  );
  saveSettingsDebounced();
}

function onPurgeClick() {
  if (!getCurrentChatId()) {
    toastr.info("No chat selected.");
    return;
  }

  // Remove all feedbacks from chat files
  const context = getContext();
  const messages = context.chat;
  messages.forEach((message) => {
    if (message.extra?.inputFeedback) {
      delete message.extra.inputFeedback;
    }
  });

  saveChatDebounced();

  // Remove all feedbacks from interface
  $(".input-feedback.content").remove();

  toastr.success("All feedbacks purged.");
}

function drawer(content, folded = true) {
  const direction = folded ? "down" : "up";
  const html = `
  <div class="inline-drawer input-feedback content">
    <div class="inline-drawer-toggle inline-drawer-header">
      <span data-i18n="[title]Input Feedback">Input Feedback</span>
      <div class="inline-drawer-icon fa-solid fa-circle-chevron-${direction} ${direction}"></div>
    </div>
    <div class="inline-drawer-content" ${
      !folded && `style="display:block"`
    }>${messageFormatting(content)}
      <div class="menu_button fa-solid fa-trash-can input-feedback-delete-button" title="Delete feedback" data-i18n="[title]Delete feedback"></div>
    </div>
  </div>`;

  return html;
}

function showLoading(messageId) {
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
    feedbackDiv.replaceWith(drawer(feedback, extensionSettings.folded));
  } else {
    // If the div doesn't exist, create it
    $(`.mes[mesid="${messageId}"] .mes_block`).append(
      drawer(feedback, extensionSettings.folded)
    );
  }
}

function addFeedbackButton(messageId) {
  $(`.mes[mesid=${messageId}] .mes_block .extraMesButtons`).append(
    `<div title="Request Feedback" class="mes_feedback fa-solid fa-spell-check" data-i18n="[title]Request Feedback"></div>`
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

  // These are listeners for events
  $("#input-feedback-enabled").on("input", onEnabledInput);
  $("#input-feedback-auto-new").on("input", onAutoNewInput);
  $("#input-feedback-auto-edit").on("input", onAutoEditInput);
  $("#input-feedback-folded").on("input", onFoldedInput);
  $("#input-feedback-template").on("input", onTemplateInput);
  $("#input-feedback-prompt").on("input", onPromptInput);
  $("#input-feedback-num-prev-msgs").on("input", onNumPrevMsgsInput);
  $("#input-feedback-purge").on("click", onPurgeClick);

  // Load settings when starting things up (if you have any)
  loadSettings();

  // Register event listeners
  eventSource.on(event_types.MESSAGE_EDITED, handleMessageEdited);
  eventSource.on(event_types.USER_MESSAGE_RENDERED, handleUserMessageRendered);
  eventSource.on(event_types.CHAT_CHANGED, handleChatChanged);

  // Add feedback button to existing messages to trigger a feedback request
  $(document).on("click", ".mes_feedback", function () {
    if (!extensionSettings.enabled) {
      return;
    }
    const messageBlock = $(this).closest(".mes");
    const messageId = Number(messageBlock.attr("mesid"));
    getFeedback(messageId);
  });

  $(document).on("click", ".input-feedback-delete-button", function () {
    if (!extensionSettings.enabled) {
      return;
    }
    const messageBlock = $(this).closest(".mes");
    const messageId = Number(messageBlock.attr("mesid"));
    deleteMessage(messageId);
  });
});
