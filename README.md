# Google Generative AI CLI

This is a Node.js command-line interface (CLI) tool created by [Arindam](https://x.com/Arindam_1729) that interacts with the Google Generative AI API to generate content based on user input. The tool allows you to ask questions directly or provide context from files, directories, or PDFs.

## Installation

To install this package, you need to have Node.js and npm installed. You can install the package globally using npm:

```sh
npm install -g gen-ai-chat
```

## Usage

### Basic Usage

To ask a question directly from the command line:

```sh
npx gen-ai-chat "Your question here"
```

### Using a File for Context

To provide additional context from a file, use the `-f` flag followed by the file path:

```sh
npx gen-ai-chat "Your question here" -f /path/to/your/file.txt
```

### Using a Directory for Context

To provide additional context from all files in a directory, use the `-d` flag followed by the directory path:

```sh
npx gen-ai-chat "Your question here" -d /path/to/your/directory
```

### Using a PDF for Context

To provide additional context from a PDF file, use the `--pdf` or `-p` flag followed by the file path:

```sh
npx gen-ai-chat "Your question here" --pdf /path/to/your/file.pdf
```

### Interactive Mode

To start the tool in interactive mode, where you can ask multiple questions in a session:

```sh
npx gen-ai-chat -i
```

or

```sh
npx gen-ai-chat --interactive
```

In interactive mode, the prompt `gen-ai-chat>` will appear, indicating that the tool is ready for you to type your question or command. 

To exit interactive mode, type `exit` or `quit` and press Enter.

### Choosing Your Favorite Model

You can choose your favorite model interactively by using the `--choose-model` option:

```sh
npx gen-ai-chat --choose-model
```

This command will prompt you to select a model from the available options:

```
? Please select a model: (Use arrow keys)
❯ gemini-pro 
  gemini-1.5-flash-latest 
  gemini-1.5-pro-latest 
  gemini-pro-vision 
  text-embedding-004
```

Alternatively, you can specify the model directly using the `--model` option followed by the model name:

```sh
npx gen-ai-chat "Your question here" --model gemini-1.5-flash-latest
```

### Writing Logs to File

By default, logs are stored in memory. To write the in-memory logs to a file, use the `--write-logs` option:

```sh
npx gen-ai-chat --write-logs
```

## Environment Variables

You can provide your own API key by setting the `API_KEY` environment variable in a `.env` file:

```env
API_KEY=your_google_gemini_api_key
```

If you do not provide your own API key, the tool will use a default key with a request limit of 10 requests per hour.

## Example

### Asking a Question

```sh
npx gen-ai-chat "What is the capital of France?"
```

### Asking a Question with File Context

```sh
npx gen-ai-chat "Summarize the content of this file" -f ./example.txt
```

### Asking a Question with Directory Context

```sh
npx gen-ai-chat "Summarize the content of these files" -d ./example-directory
```

### Asking a Question with PDF Context

```sh
npx gen-ai-chat "Summarize the content of this PDF" --pdf ./example.pdf
```

### Choosing a Model

```sh
npx gen-ai-chat --choose-model
```

or

```sh
npx gen-ai-chat "Your question here" --model gemini-1.5-flash-latest
```

### Writing Logs to a File

```sh
npx gen-ai-chat --write-logs
```

This command will write all in-memory logs to a file in the logs directory.

## Error Handling

- If you do not provide a question, the CLI will prompt you to ask a question.
- If the file path provided with the `-f` flag is invalid, an error message will be displayed.
- If the directory path provided with the `-d` flag is invalid, an error message will be displayed.
- If the request limit is reached and no user API key is provided, a message will be displayed indicating that the request limit has been reached.
- If the selected model fails, the tool will fallback to `gemini-pro` and try again.
- If the API key is missing or invalid, an error message will be displayed.
- If there is a network issue, an error message will be displayed indicating the problem.
- If the response from the API is malformed or unexpected, an error message will be displayed.

## Key Points

- **Presence of .env File**: The `.env` file must be present in the directory from which the `npx` command is executed.
- **Loading Environment Variables**: The script uses `require('dotenv').config();` to load the environment variables from the `.env` file.
- **Accessing the API Key**: The script accesses the API key from `process.env.API_KEY`.
- **Model Fallback**: If the selected model fails, the tool will fallback to `gemini-pro` and try again.

By ensuring the `.env` file is in the correct location and the script is configured to load it, the script will be able to access the API key when run with `npx`.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Contact

For any questions or issues, please open an issue on the GitHub repository.