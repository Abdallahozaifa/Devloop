import { Command } from 'commander';
import { parseNaturalLanguage, addTestToSpecFile } from '../core/spec/generators/generator.js';
import { generateSpecsWithAI, autoSaveSpecs, interactiveSpecReview, printSpecSummary, generateComprehensiveSpecs, generateBackendFirstSpecs } from '../core/spec/generators/ai-generator.js';
import { analyzeBackend, findFrontendPaths, extractBackendRequirements, printBackendRequirements } from '../core/spec/backend-analyzer.js';
import { generateComprehensiveSpec, saveComprehensiveSpec, getSpecSummary } from '../core/spec/generators/comprehensive-generator.js';
import { generateUniversalSpec, saveUniversalSpec, getUniversalSpecSummary } from '../core/spec/generators/universal-generator.js';
import { validateSpec } from '../core/spec/comprehensive-spec-format.js';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import chalk from 'chalk';
import readline from 'readline';
import { CONFIG_DIR } from '../core/config.js';

export function createSpecCommand() {
  const spec = new Command('spec')
    .description('Add test specifications in plain English')
    .argument('[description...]', 'Natural language test description')
    .option('-f, --file <file>', 'Spec file to add to', 'api.spec.yaml')
    .option('-i, --interactive', 'Interactive mode')
    .action(async (descriptionParts, options) => {
      const specsDir = path.join(process.cwd(), '.devloop', 'specs');
      const specFile = path.join(specsDir, options.file);

      if (options.interactive || descriptionParts.length === 0) {
        await interactiveMode(specFile);
        return;
      }

      const description = descriptionParts.join(' ');
      const test = parseNaturalLanguage(description);

      if (!test) {
        console.log(chalk.red('\n❌ Could not parse specification.\n'));
        console.log('Try one of these formats:');
        console.log(chalk.cyan('  devloop spec "guests can access /health"'));
        console.log(chalk.cyan('  devloop spec "guests cannot access /admin"'));
        console.log(chalk.cyan('  devloop spec "authenticated users can access /projects"'));
        console.log(chalk.cyan('  devloop spec "creating a project returns id and name"'));
        console.log(chalk.cyan('  devloop spec "/api/health returns 200"'));
        console.log(chalk.cyan('  devloop spec "clients can access /portal/{token} without login"'));
        console.log(chalk.cyan('  devloop spec "authenticated users get 200 on /billing/subscription"'));
        console.log('');
        return;
      }

      addTestToSpecFile(test, specFile);
      console.log(chalk.green(`\n✅ Added spec: ${test.name}`));
      console.log(chalk.gray(`   File: ${specFile}\n`));
    });

  spec.command('list')
    .description('List all specs')
    .action(() => {
      const specsDir = path.join(process.cwd(), '.devloop', 'specs');
      if (!fs.existsSync(specsDir)) {
        console.log(chalk.yellow('\nNo specs found. Create one with: devloop spec "your test description"\n'));
        return;
      }

      const files = fs.readdirSync(specsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (files.length === 0) {
        console.log(chalk.yellow('\nNo spec files found.\n'));
        return;
      }

      console.log(chalk.cyan(`\n📋 Found ${files.length} spec file(s):\n`));

      for (const file of files) {
        const filePath = path.join(specsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const spec = yaml.load(content);
        const testCount = spec.tests?.length || 0;

        console.log(chalk.white(`   • ${file}`));
        console.log(chalk.gray(`     ${testCount} test(s)`));

        if (spec.tests && spec.tests.length > 0) {
          for (const test of spec.tests.slice(0, 3)) {
            console.log(chalk.gray(`       - ${test.name}`));
          }
          if (spec.tests.length > 3) {
            console.log(chalk.gray(`       ... and ${spec.tests.length - 3} more`));
          }
        }
        console.log('');
      }
    });

  spec.command('init')
    .description('Initialize specs with common tests')
    .action(() => {
      const specsDir = path.join(process.cwd(), '.devloop', 'specs');

      // Create default specs
      const defaultSpecs = {
        name: 'API Tests',
        description: 'Auto-generated API test specifications',
        roles: {
          guest: {},
          user: {
            credentials: {
              email: 'test@example.com',
              password: 'password123'
            }
          }
        },
        tests: [
          {
            name: 'Health endpoint is accessible',
            as: 'guest',
            request: { method: 'GET', path: '/health' },
            expect: { status: 200 }
          },
          {
            name: 'Unauthenticated request returns 401',
            as: 'guest',
            request: { method: 'GET', path: '/api/v1/projects' },
            expect: { status: 401 }
          }
        ]
      };

      if (!fs.existsSync(specsDir)) {
        fs.mkdirSync(specsDir, { recursive: true });
      }

      const specFile = path.join(specsDir, 'api.spec.yaml');
      fs.writeFileSync(specFile, yaml.dump(defaultSpecs, { indent: 2, lineWidth: -1 }));

      console.log(chalk.green(`\n✅ Initialized specs at ${specsDir}`));
      console.log(chalk.cyan('\nRun tests with: devloop test\n'));
    });

  spec.command('show')
    .description('Show contents of a spec file')
    .argument('[file]', 'Spec file to show', 'api.spec.yaml')
    .action((file) => {
      const specsDir = path.join(process.cwd(), '.devloop', 'specs');
      const specFile = path.join(specsDir, file);

      if (!fs.existsSync(specFile)) {
        console.log(chalk.red(`\n❌ Spec file not found: ${specFile}\n`));
        return;
      }

      const content = fs.readFileSync(specFile, 'utf-8');
      console.log(chalk.cyan(`\n--- ${file} ---\n`));
      console.log(content);
    });

  spec.command('generate')
    .description('AI-generate comprehensive sandwich specs (API + Contract + UI)')
    .option('-y, --yes', 'Auto-save without review')
    .option('--audit', 'Run audit first to refresh discovery')
    .option('--basic', 'Generate basic specs only (not recommended - use for simple projects)')
    .option('-v, --verbose', 'Show verbose output')
    .option('--file <file>', 'Output spec file name (default: derived from project or "application.spec.yaml")')
    .action(async (options) => {
      const projectDir = process.cwd();
      const specsDir = path.join(projectDir, '.devloop', 'specs');
      const configDir = path.join(projectDir, CONFIG_DIR);
      const discoveryFile = path.join(configDir, 'discovery.json');

      // BASIC mode (legacy, not recommended)
      if (options.basic) {
        console.log(chalk.yellow('\n⚠️  Using basic mode (not recommended)'));
        console.log(chalk.yellow('   For comprehensive specs that catch more bugs, remove --basic flag.\n'));

        // Load or run discovery
        let discovery;

        if (options.audit || !fs.existsSync(discoveryFile)) {
          console.log(chalk.cyan('Running audit to discover API...\n'));
          try {
            const { auditCommand } = await import('./audit.js');
            await auditCommand({ verbose: options.verbose });
          } catch (err) {
            console.log(chalk.red(`\n❌ Audit failed: ${err.message}\n`));
            return;
          }
        }

        if (fs.existsSync(discoveryFile)) {
          try {
            discovery = JSON.parse(fs.readFileSync(discoveryFile, 'utf-8'));
            console.log(chalk.green(`✅ Loaded discovery from ${discoveryFile}`));
          } catch (err) {
            console.log(chalk.red(`\n❌ Could not parse discovery.json: ${err.message}\n`));
            return;
          }
        } else {
          console.log(chalk.red('\n❌ No discovery.json found. Run: devloop audit\n'));
          return;
        }

        // Generate basic specs with AI
        try {
          const specs = await generateSpecsWithAI(discovery, { verbose: options.verbose });

          if (specs.length === 0) {
            console.log(chalk.yellow('\n❌ No specs generated. Check your API discovery.\n'));
            return;
          }

          // Print summary
          printSpecSummary(specs);

          // Save specs
          let savedFiles;
          if (options.yes) {
            savedFiles = await autoSaveSpecs(specs, specsDir);
            console.log(chalk.green(`\n✅ Saved ${savedFiles.length} spec file(s):`));
            savedFiles.forEach(f => console.log(chalk.gray(`   • ${f}`)));
          } else {
            savedFiles = await interactiveSpecReview(specs, specsDir);
          }

          if (savedFiles && savedFiles.length > 0) {
            console.log(chalk.cyan('\n🚀 Run tests with: devloop test --api-url <your-api-url>\n'));
          }
        } catch (err) {
          if (err.message.includes('ANTHROPIC_API_KEY')) {
            console.log(chalk.red('\n❌ ' + err.message));
            console.log(chalk.gray('   Get your API key at: https://console.anthropic.com/\n'));
          } else {
            console.log(chalk.red(`\n❌ AI generation failed: ${err.message}\n`));
            if (options.verbose) {
              console.error(err.stack);
            }
          }
        }
        return;
      }

      // DEFAULT: Universal spec generation - ONE comprehensive file
      console.log(chalk.cyan('\n📋 Generating Universal Specification\n'));
      console.log(chalk.gray('   Universal specs contain ALL sections in ONE file:'));
      console.log(chalk.gray('   📦 models - data schema with types & relationships'));
      console.log(chalk.gray('   🔌 api - endpoints with ALL response codes'));
      console.log(chalk.gray('   📜 rules - business logic in plain English'));
      console.log(chalk.gray('   🖥️  ui - frontend components with behavior'));
      console.log(chalk.gray('   📜 contracts - frontend-backend alignment checks'));
      console.log(chalk.gray('   🧪 tests - API and UI tests\n'));

      try {
        const spec = await generateUniversalSpec(projectDir, { verbose: options.verbose });

        if (!spec) {
          console.log(chalk.yellow('\n❌ No spec generated. Check the verbose output for details.\n'));
          return;
        }

        // Get and display summary
        const summary = getUniversalSpecSummary(spec);

        console.log(chalk.green('\n✅ Generated Universal Spec:\n'));
        console.log(chalk.white(`   📦 Models:     ${summary.models}`));
        console.log(chalk.white(`   🔌 Endpoints:  ${summary.endpoints}`));
        console.log(chalk.white(`   📜 Rules:      ${summary.rules}`));
        console.log(chalk.white(`   🖥️  Components: ${summary.components}`));
        console.log(chalk.white(`   📜 Contracts:  ${summary.contracts}`));
        console.log(chalk.white(`   🧪 API Tests:  ${summary.apiTests}`));
        console.log(chalk.white(`   🧪 UI Tests:   ${summary.uiTests}`));

        // Save the spec - ONE file
        const savedPath = saveUniversalSpec(spec, projectDir, options.file || spec.name || 'application');

        console.log(chalk.green(`\n✅ Saved to: ${savedPath}`));
        console.log(chalk.cyan('\n🚀 Run tests with: devloop test --api-url <your-api-url>\n'));

        // Show verbose output if requested
        if (options.verbose) {
          console.log(chalk.cyan('\n--- Full Spec YAML ---\n'));
          console.log(yaml.dump(spec, { indent: 2, lineWidth: 120 }));
        }

      } catch (err) {
        if (err.message.includes('ANTHROPIC_API_KEY')) {
          console.log(chalk.red('\n❌ ' + err.message));
          console.log(chalk.gray('   Get your API key at: https://console.anthropic.com/\n'));
        } else {
          console.log(chalk.red(`\n❌ Universal spec generation failed: ${err.message}\n`));
          if (options.verbose) {
            console.error(err.stack);
          }
        }
      }
    });

  // Comprehensive spec creation command
  spec.command('create <feature>')
    .description('Create a comprehensive spec for a feature (models, API, rules, UI, tests)')
    .option('-o, --output <file>', 'Output file name (default: <feature>.spec.yaml)')
    .option('-v, --verbose', 'Show verbose output')
    .action(async (feature, options) => {
      const projectDir = process.cwd();

      console.log(chalk.cyan(`\n📋 Creating Comprehensive Spec for: ${feature}\n`));
      console.log(chalk.gray('   This spec will include:'));
      console.log(chalk.gray('   📦 Data models with types, constraints, relationships'));
      console.log(chalk.gray('   🔌 API endpoints with ALL response codes'));
      console.log(chalk.gray('   📜 Business rules in plain English'));
      console.log(chalk.gray('   🖥️  Frontend components with behavior'));
      console.log(chalk.gray('   📜 Contract checks (frontend-backend agreement)'));
      console.log(chalk.gray('   🧪 API and UI tests\n'));

      try {
        // Generate the comprehensive spec
        const spec = await generateComprehensiveSpec(feature, projectDir);

        if (!spec) {
          console.log(chalk.red('\n❌ Failed to generate spec. Check your ANTHROPIC_API_KEY.\n'));
          return;
        }

        // Validate the generated spec
        const validation = validateSpec(spec);

        if (!validation.valid) {
          console.log(chalk.yellow('\n⚠️  Spec validation warnings:'));
          validation.errors.forEach(e => console.log(chalk.red(`   ❌ ${e}`)));
        }

        if (validation.warnings.length > 0) {
          validation.warnings.forEach(w => console.log(chalk.yellow(`   ⚠️  ${w}`)));
        }

        // Get spec summary
        const summary = getSpecSummary(spec);

        console.log(chalk.green('\n✅ Generated Comprehensive Spec:\n'));
        console.log(chalk.white(`   📦 Models:     ${summary.models}`));
        console.log(chalk.white(`   🔌 Endpoints:  ${summary.endpoints}`));
        console.log(chalk.white(`   📜 Rules:      ${summary.rules}`));
        console.log(chalk.white(`   🖥️  Components: ${summary.components}`));
        console.log(chalk.white(`   📜 Contracts:  ${summary.contracts}`));
        console.log(chalk.white(`   🧪 API Tests:  ${summary.apiTests}`));
        console.log(chalk.white(`   🧪 UI Tests:   ${summary.uiTests}`));

        // Save the spec
        const featureName = options.output || feature.toLowerCase().replace(/\s+/g, '-');
        const savedPath = saveComprehensiveSpec(spec, projectDir, featureName);

        console.log(chalk.green(`\n✅ Saved to: ${savedPath}`));
        console.log(chalk.cyan('\n🚀 This spec is ready for Claude to implement!\n'));
        console.log(chalk.gray('   Hand this spec to Claude with:'));
        console.log(chalk.gray(`   "Implement the ${feature} feature according to this spec"\n`));

        // Show verbose output if requested
        if (options.verbose) {
          console.log(chalk.cyan('\n--- Full Spec YAML ---\n'));
          console.log(yaml.dump(spec, { indent: 2, lineWidth: 120 }));
        }

      } catch (err) {
        if (err.message.includes('ANTHROPIC_API_KEY')) {
          console.log(chalk.red('\n❌ ' + err.message));
          console.log(chalk.gray('   Get your API key at: https://console.anthropic.com/\n'));
        } else {
          console.log(chalk.red(`\n❌ Spec creation failed: ${err.message}\n`));
          if (options.verbose) {
            console.error(err.stack);
          }
        }
      }
    });

  return spec;
}

async function interactiveMode(specFile) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (q) => new Promise(resolve => rl.question(q, resolve));

  console.log(chalk.cyan('\n🧪 Interactive Spec Builder\n'));

  const name = await question('Test name: ');
  const role = await question('Role (guest/user): ') || 'guest';
  const method = await question('Method (GET/POST/PUT/DELETE): ') || 'GET';
  const pathInput = await question('Path: ');
  const status = await question('Expected status: ') || '200';

  const test = {
    name,
    as: role,
    request: { method: method.toUpperCase(), path: pathInput },
    expect: { status: parseInt(status) }
  };

  addTestToSpecFile(test, specFile);
  console.log(chalk.green(`\n✅ Added spec to ${specFile}\n`));

  rl.close();
}
