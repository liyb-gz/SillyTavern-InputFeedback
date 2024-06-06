# SillyTavern Extension: Input feedback

This extension provides AI-generated feedback on your input. It sends your current message along with some previous messages as context to the AI, which returns (hopefully) insightful feedback. The feedback is then displayed in a foldable panel below your message. As it does not become part of the chat context, the characters remain unaware of it. Particularly useful for language learning.

![Example](/img/input-feedback.gif)

## Installation and Usage

### Installation

In SillyTavern's "Extensions" page, click "Install extension", and type `https://github.com/liyb-gz/SillyTavern-InputFeedback`

### Options

- **Enabled**: if unchecked, will behave as if the extension is not installed.
- **Automatically request feedbacks**: if checked, will send feedback requests whenever you write or edit a message; otherwise, you can click the button to send the request manually.
- **Fold feedback by default**: if checked, the feedback panel will be folded by default, so that you can focus on the roleplay and check the feedbacks later.
- **Template**: The template used to send the feedback request. `{{previousMessages}}`, `{{message}}` and `{{prompt}}` will be replaced with the real content. If they are not in the template, the AI won't have access to them.
- **Prompt**: The prompt used to request for feedback.

## License

AGPL-3.0
