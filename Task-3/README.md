# AI-Powered Personal Learning Assistant Telegram Bot

This project is an AI-powered personal learning assistant built with n8n and delivered as a Telegram bot.

It allows users to:
- submit learning materials via URL,
- receive a structured summary,
- generate a quiz based on the material,
- answer quiz questions one by one in Telegram,
- receive a final score with feedback and explanations.

## Features

- `/start` command with bot introduction
- `/learn [url]` command to process a learning resource
- `/quiz` command to choose from saved topics and start a quiz


## Bot Commands

### `/start`

Starts the bot and stores user data in the database.

### `/learn [url]`

Fetches the provided URL, extracts the content, generates a structured summary, stores the material, and offers a button to start a quiz.

Example:

/learn https://react.dev/learn/reacting-to-input-with-state

### `/quiz`

Shows the list of previously saved learning materials and lets the user choose one for quiz generation.


## Usage
1. Open the Telegram bot
2. Send /start
3. Send /learn [url]
4. Read the generated summary
5. Start a quiz using:
  - the Start Quiz button
  - or /quiz
6. Answer the 5 questions
7. Review the final results

