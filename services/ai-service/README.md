# AI Service

Intelligence engine providing LLM-powered capabilities across the ClickUp OSS platform.

## 🚀 AI Capabilities

- **Task Breakdown**: Automatically generate subtasks and checklists from a task description.
- **Writing Assistant**: Polish, expand, shorten, or translate text in tasks and docs.
- **Daily Planner**: Suggest a prioritized schedule based on due dates and priorities.
- **Summarization**: Condense long task threads or documents into key points.
- **Meeting Notes Extraction**: Convert transcripts into structured action items and decisions.
- **Smart Task Creation**: Parse natural language (e.g., "Remind me to fix the bug by Friday") into structured tasks.

## 🏗️ Architecture

The AI service is designed to be model-agnostic, currently supporting **Anthropic Claude** and **OpenAI GPT**.

- **Prompt Builder**: Centralized management of complex multi-shot prompts.
- **Context Fetcher**: Securely aggregates data from Task and Doc services before sending to the LLM.
- **Rate Limiting**: Intelligent queuing to stay within provider tier limits.

## 🔌 API Endpoints

- `POST /ai/breakdown`: Analyze task and return structured subtasks.
- `POST /ai/summarize`: Multi-model summarization of task/comment history.
- `POST /ai/writing-assistant`: Text transformation (formalize, casual, translate, etc.).
- `POST /ai/smart-tasks`: NLP-to-task conversion.

## 🛠️ Tech Stack

- **Node.js / Express**
- **Anthropic SDK / OpenAI SDK**
- **Zod**: For strict output parsing and schema enforcement.
