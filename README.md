# Google Generative AI CLI

This is a Node.js command-line interface (CLI) tool that interacts with the Google Generative AI API to generate content based on user input. The tool allows you to ask questions directly or provide context from files or directories.

## Installation

To install this package, you need to have Node.js and npm installed. You can install the package globally using `npx`:

```sh
npx gen-ai
```

## Usage

### Basic Usage

To ask a question directly from the command line:

```sh
npx gen-ai "Your question here"
```

### Using a File for Context

To provide additional context from a file, use the `-f` flag followed by the file path:

```sh
npx gen-ai "Your question here" -f /path/to/your/file.txt
```

### Using a Directory for Context

To provide additional context from all files in a directory, use the `-d` flag followed by the directory path:

```sh
npx gen-ai "Your question here" -d /path/to/your/directory
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
npx gen-ai "What is the capital of France?"
```

### Asking a Question with File Context

```sh
npx gen-ai "Summarize the content of this file" -f ./example.txt
```

### Asking a Question with Directory Context

```sh
npx gen-ai "Summarize the content of these files" -d ./example-directory
```

## Error Handling

- If you do not provide a question, the CLI will prompt you to ask a question.
- If the file path provided with the `-f` flag is invalid, an error message will be displayed.
- If the directory path provided with the `-d` flag is invalid, an error message will be displayed.
- If the request limit is reached and no user API key is provided, a message will be displayed indicating that the request limit has been reached.

## Key Points

- **Presence of `.env` File**: The `.env` file must be present in the directory from which the `npx` command is executed.
- **Loading Environment Variables**: The script uses `require('dotenv').config();` to load the environment variables from the `.env` file.
- **Accessing the API Key**: The script accesses the API key from `process.env.API_KEY`.

By ensuring the `.env` file is in the correct location and the script is configured to load it, the script will be able to access the API key when run with `npx`.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Contact

For any questions or issues, please open an issue on the GitHub repository.