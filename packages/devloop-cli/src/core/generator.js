import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getProjectRoot } from './config.js';

const MODEL = 'claude-sonnet-4-20250514';

let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export async function generatePlan(description, context) {
  const client = getAnthropicClient();

  const systemPrompt = `You are an expert software architect. Your task is to create a detailed implementation plan for a feature request.

Given the codebase context and a feature description, create a step-by-step plan that includes:
1. What files need to be created or modified
2. The order of changes
3. Key implementation details

Output your plan as JSON with this structure:
{
  "summary": "Brief description of what will be built",
  "steps": [
    {
      "description": "Step description",
      "files": ["path/to/file1.ts", "path/to/file2.ts"],
      "type": "create" | "modify"
    }
  ],
  "files": [
    {
      "path": "path/to/file.ts",
      "action": "create" | "modify",
      "description": "What this file does"
    }
  ],
  "tests": ["test1.test.ts", "test2.test.ts"],
  "dependencies": ["package-name@version"]
}

Be concise and practical. Match the project's existing patterns and conventions.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `# Codebase Context

${context}

---

# Feature Request

${description}

---

Please create an implementation plan as JSON.`,
      },
    ],
  });

  // Parse JSON from response
  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse plan from response');
  }

  return JSON.parse(jsonMatch[0]);
}

export async function generateCode(plan, context, fileIndex = 0) {
  const client = getAnthropicClient();
  const file = plan.files[fileIndex];

  const systemPrompt = `You are an expert software developer. Generate production-quality code based on the implementation plan and codebase context.

Rules:
1. Follow the project's existing patterns and conventions
2. Use TypeScript/JavaScript best practices
3. Include necessary imports
4. Add JSDoc comments for public APIs
5. Handle errors appropriately
6. Keep code clean and readable

Output ONLY the file content, no explanations or markdown code blocks.
If the file already exists and action is "modify", output the complete modified file.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `# Implementation Plan

${JSON.stringify(plan, null, 2)}

---

# Codebase Context

${context}

---

# Task

Generate the code for file: ${file.path}
Action: ${file.action}
Description: ${file.description}

Output only the file content:`,
      },
    ],
  });

  return {
    path: file.path,
    content: response.content[0].text.trim(),
    action: file.action,
  };
}

export async function generateTests(plan, context, generatedCode) {
  const client = getAnthropicClient();

  const codeContext = generatedCode
    .map((f) => `## ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const systemPrompt = `You are an expert software tester. Generate comprehensive tests for the newly created code.

Rules:
1. Use the project's existing test framework
2. Test both happy paths and edge cases
3. Use descriptive test names
4. Mock external dependencies
5. Keep tests focused and readable

Output the test file content directly, no markdown blocks.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `# Implementation Plan

${JSON.stringify(plan, null, 2)}

---

# Generated Code

${codeContext}

---

# Codebase Context (test patterns)

${context}

---

Generate test file for the new code:`,
      },
    ],
  });

  return {
    path: plan.tests?.[0] || 'tests/generated.test.ts',
    content: response.content[0].text.trim(),
  };
}

export function writeFiles(files, projectRoot = getProjectRoot()) {
  const written = [];

  for (const file of files) {
    const fullPath = path.join(projectRoot, file.path);
    const dir = path.dirname(fullPath);

    // Create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(fullPath, file.content);
    written.push(file.path);
  }

  return written;
}

export async function generateFix(error, context, codebase) {
  const client = getAnthropicClient();

  const systemPrompt = `You are an expert debugger. Analyze the error and codebase context to generate a fix.

Output your fix as JSON:
{
  "analysis": "Brief explanation of the root cause",
  "files": [
    {
      "path": "path/to/file.ts",
      "action": "modify",
      "changes": "Description of changes",
      "content": "Complete file content after fix"
    }
  ]
}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `# Error

${error}

---

# Codebase Context

${context}

---

Analyze and fix this error. Output as JSON:`,
      },
    ],
  });

  const text = response.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse fix from response');
  }

  return JSON.parse(jsonMatch[0]);
}
