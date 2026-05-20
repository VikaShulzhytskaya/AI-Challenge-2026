# Report

## Tools and Technologies Used

- n8n
- Telegram Bot API
- PostgreSQL
- n8n AI Agent node
- HTTP Request nodes
- Code nodes for parsing, formatting, validation, and routing

## AI Roles

### Teacher

The Teacher role is responsible for:
- analyzing extracted learning material,
- generating a structured summary,
- identifying the difficulty level,
- extracting key points and main concepts.

The Teacher output is returned as structured JSON and then stored in the database.

### Examiner

The Examiner role is responsible for:
- generating exactly 5 multiple-choice quiz questions,
- assigning correct answers,
- providing explanations,
- supporting final result generation.

The Examiner output is also returned as structured JSON and then saved in the quiz-related tables.

## Workflow Design Decisions

### 1. PostgreSQL instead of SQLite

Because the project was built in n8n Cloud, PostgreSQL was used instead of SQLite. This ensured proper persistence between sessions and better compatibility with a cloud-based setup.

### 2. Structured JSON outputs from AI

Both Teacher and Examiner were instructed to return valid JSON only. This reduced ambiguity and made it possible to:
- validate AI output,
- save it in PostgreSQL,
- reuse it in later workflow steps.

### 3. Separation of message updates and callback queries

The workflow was split into:
- message-based handling for `/start`, `/learn`, `/quiz`
- callback-based handling for inline button actions

This made the workflow easier to maintain and allowed support for both command-based and button-based interactions.

### 4. Shared quiz generation flow

Both quiz entry points:
- `Start Quiz` after summary
- `/quiz` topic selection

were merged into a common flow that:
- loads a selected material,
- generates questions,
- stores the quiz,
- starts a quiz session.

This avoided logic duplication.

### 5. Persistent quiz sessions

A dedicated `quiz_sessions` table was used to track:
- the active quiz,
- current question number,
- completion status,
- final score.

This made it possible to continue quiz logic across multiple Telegram callback events.

### 6. Duplicate-answer protection

To prevent accidental double answers:
- a workflow check was added before inserting an answer,
- a database uniqueness constraint was added on `(session_id, question_id)`.

### 7. Outdated-button protection

Initially, answer callbacks only contained `sessionId` and selected option. This caused a bug where a user could click an older question button and the answer would be applied to the current question. This was fixed by including `questionOrder` in callback data and validating it against the current question stored in the active session.

## What Worked Well

- Telegram command handling worked reliably after separating message and callback flows
- Teacher summaries were relevant to the submitted URLs
- Examiner question generation was specific to the material and not hardcoded
- PostgreSQL worked well for persistence and quiz state management
- Inline buttons made the quiz interaction smooth
- Final results with score and explanations matched the task requirements

## What Was Challenging

### 1. Telegram callback routing

It was necessary to separate:
- normal messages
- callback query events

Otherwise, command logic and button logic interfered with each other.

### 2. URL validation in n8n expressions

Using `new URL()` in some n8n expression contexts caused issues. This was resolved by switching to a more stable validation approach.

### 3. Telegram inline keyboard payload formatting

Telegram button payloads had to be carefully serialized as valid JSON. There were also practical limits on `callback_data`, which required shortening the payload format.

### 4. Postgres node output behavior

Some Postgres nodes returned different output shapes than the original input. Because of that, later nodes sometimes had to reference earlier nodes explicitly instead of relying on the current `$json`.

### 5. Edge cases around quiz answering

Two important edge cases appeared during development:
- duplicate clicks on the same answer button
- clicking an old question after the session had already advanced

Both were addressed in the final workflow.

## What Did Not Work Initially

- Using `new URL()` directly in n8n expressions was unreliable in this environment
- Inline keyboard JSON formatting failed when objects were embedded directly into raw JSON strings
- Callback payloads that were too long triggered Telegram `BUTTON_DATA_INVALID` errors
- Relying only on `sessionId` in answer callbacks caused incorrect answer mapping for older messages
