/**
 * DevLoop Lint Command
 * Fast static analysis to catch API/frontend shape mismatches
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Dangerous patterns that suggest calling array methods on paginated responses
const DANGEROUS_PATTERNS = [
  {
    // data.filter() or data.map() without accessing .items
    pattern: /const\s+\{\s*data:\s*(\w+)\s*[,}][\s\S]{0,500}?\1\.(filter|map|forEach|reduce|find|some|every)\(/g,
    check: (content, varName) => {
      // Safe if accessing .items or similar wrapper
      if (content.includes(`${varName}?.items`) ||
          content.includes(`${varName}.items`) ||
          content.includes(`${varName}?.data`) ||
          content.includes(`${varName}.data`)) return false;

      // Safe if hook uses select: to transform data (already unwrapped)
      const hookPattern = new RegExp(`data:\\s*${varName}[^}]*}\\s*=\\s*use\\w+`);
      const hookMatch = content.match(hookPattern);
      if (hookMatch) {
        // Find the hook definition and check for select:
        const hookNameMatch = content.match(new RegExp(`=\\s*(use\\w+)\\s*\\(`));
        if (hookNameMatch) {
          // Check if there's a select function in the hook call or hook definition
          const hookCallArea = content.substring(0, content.indexOf(`data: ${varName}`));
          if (hookCallArea.includes('select:') || hookCallArea.includes('select :')) return false;
        }
      }
      return true;
    },
    issue: 'Calling array method on API response without unwrapping',
    fix: (varName) => `Use ${varName}?.items?.method() for paginated responses`
  },
  {
    // response || [] pattern without accessing nested array
    pattern: /(\w+)\s*\|\|\s*\[\]/g,
    check: (content, varName, match) => {
      // Check if this is from a hook that returns paginated data
      const beforeMatch = content.substring(0, match.index);
      const isFromHook = beforeMatch.includes(`data: ${varName}`) ||
                         beforeMatch.includes(`useQuery`) ||
                         beforeMatch.includes(`usePortal`);
      if (!isFromHook) return false;

      // Safe if accessing a nested property like .items || [] or .invoices || []
      const immediateContext = content.substring(Math.max(0, match.index - 50), match.index + 20);
      if (immediateContext.includes(`?.items`) ||
          immediateContext.includes(`.items`) ||
          immediateContext.includes(`?.invoices`) ||
          immediateContext.includes(`.invoices`) ||
          immediateContext.includes(`?.data`) ||
          immediateContext.includes(`.data`) ||
          immediateContext.includes(`?.clients`) ||
          immediateContext.includes(`.clients`) ||
          immediateContext.includes(`?.projects`) ||
          immediateContext.includes(`.projects`)) return false;

      return true;
    },
    issue: 'Defaulting to empty array without accessing .items wrapper',
    fix: (varName) => `Use ${varName}?.items || [] for paginated responses`
  },
  {
    // icon={ComponentName} pattern - passing component type instead of element
    // Catches React Error #31: "Objects are not valid as a React child"
    // Common with lucide-react icons which use forwardRef
    pattern: /icon=\{([A-Z][A-Za-z0-9]*)\}/g,
    check: (content, componentName, match) => {
      // Check if it's NOT already a JSX element (no < before the name)
      const matchStr = match[0];
      // Safe if it's already an element like icon={<Icon />}
      if (matchStr.includes('<')) return false;
      // Safe if it's a variable or prop (lowercase)
      if (componentName[0] !== componentName[0].toUpperCase()) return false;
      // Check if this component is imported from lucide-react or similar icon library
      const isIconImport = content.includes(`import { ${componentName}`) ||
                           content.includes(`import {${componentName}`) ||
                           content.includes(`, ${componentName}`) ||
                           content.includes(`,${componentName}`);
      // Also check if lucide-react is imported
      const hasLucideImport = content.includes('lucide-react') ||
                              content.includes('@heroicons') ||
                              content.includes('react-icons');
      return isIconImport && hasLucideImport;
    },
    issue: 'Passing component type instead of element (causes React Error #31)',
    fix: (componentName) => `Use icon={<${componentName} className="w-6 h-6" />} instead of icon={${componentName}}`
  },
  {
    // varName?.filter() on useQuery data without .items
    // Catches: projects?.filter(...) when projects is from useProjects() returning { items, total }
    pattern: /const\s+\{\s*data:\s*(\w+)[^}]*\}\s*=\s*(use\w+)\([^)]*\)[\s\S]{0,1000}?\1\?\.(filter|map|forEach|reduce|find|some|every)\(/g,
    check: (content, varName, match) => {
      // Safe if accessing .items before the method
      if (content.includes(`${varName}?.items?.`) ||
          content.includes(`${varName}.items?.`) ||
          content.includes(`${varName}?.items.`) ||
          content.includes(`${varName}.items.`)) return false;

      // Extract hook name from match
      const hookName = match[2];

      // Whitelist hooks that use select: to transform/unwrap data
      // These hooks already return raw arrays, not paginated responses
      const selectHooks = [
        'useScopeItems',
        'useScopeProgress',
        // Add more hooks here as needed
      ];
      if (selectHooks.includes(hookName)) return false;

      // Safe if the hook uses select: to transform data
      const hookDefPattern = new RegExp(`use\\w+[\\s\\S]{0,500}select:\\s*\\([^)]*\\)\\s*=>\\s*[^,}]*\\.items`);
      if (hookDefPattern.test(content)) return false;

      return true;
    },
    issue: 'Calling array method on hook response without unwrapping .items',
    fix: (varName) => `Use ${varName}?.items?.method() - hooks return { items: [], total } not raw arrays`
  },
  {
    // Direct array method on hook data variable: hookData.filter() or hookData?.filter()
    // More aggressive pattern to catch: const { data: projects } = useProjects(); ... projects.filter()
    pattern: /\b(\w+)\?\.(filter|map|forEach|reduce|find|some|every)\s*\(/g,
    check: (content, varName, match) => {
      // Check if this variable is destructured as data: varName from a hook
      const dataDestructureMatch = content.match(new RegExp(`data:\\s*${varName}\\s*[,}][^=]*=\\s*(use\\w+)\\(`));
      if (!dataDestructureMatch) return false;

      const hookName = dataDestructureMatch[1];

      // Whitelist hooks that use select: to transform/unwrap data
      // These hooks already return raw arrays, not paginated responses
      const selectHooks = [
        'useScopeItems',
        'useScopeProgress',
        // Add more hooks here as needed
      ];
      if (selectHooks.includes(hookName)) return false;

      // Safe if there's .items. before the method call anywhere in context
      const surroundingCode = content.substring(Math.max(0, match.index - 200), match.index + 100);
      if (surroundingCode.includes(`${varName}?.items`) ||
          surroundingCode.includes(`${varName}.items`)) return false;

      return true;
    },
    issue: 'Hook data likely returns { items: [], total }, not a raw array',
    fix: (varName) => `Use ${varName}?.items?.method() for paginated hook responses`
  }
];

/**
 * Analyze a file for shape mismatch issues
 */
function analyzeFile(filePath, content) {
  const issues = [];

  for (const { pattern, check, issue, fix } of DANGEROUS_PATTERNS) {
    // Reset regex
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const varName = match[1];

      if (check(content, varName, match)) {
        // Get line number
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          file: filePath,
          line: lineNumber,
          issue,
          fix: fix(varName),
          code: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : '')
        });
      }
    }
  }

  return issues;
}

/**
 * Run lint command
 */
export async function lint(options = {}) {
  const projectDir = options.cwd || process.cwd();
  const startTime = Date.now();

  console.log('🔍 Checking for shape mismatches...\n');

  // Find frontend files
  const patterns = [
    'apps/web/src/**/*.tsx',
    'apps/web/src/**/*.ts',
    'src/**/*.tsx',
    'src/**/*.ts',
    'frontend/**/*.tsx',
    'frontend/**/*.ts',
    'client/**/*.tsx',
    'client/**/*.ts'
  ];

  let files = [];
  for (const pattern of patterns) {
    try {
      const found = await glob(pattern, {
        cwd: projectDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts']
      });
      files.push(...found);
    } catch {
      // Pattern not found, skip
    }
  }

  files = [...new Set(files)]; // Dedupe

  if (files.length === 0) {
    console.log('   No frontend files found to lint.\n');
    return { issues: [], duration: Date.now() - startTime };
  }

  console.log(`   Scanning ${files.length} files...\n`);

  const allIssues = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(projectDir, file), 'utf-8');
      const fileIssues = analyzeFile(file, content);
      allIssues.push(...fileIssues);
    } catch {
      // Skip unreadable files
    }
  }

  const duration = Date.now() - startTime;

  // Output results
  if (options.json) {
    console.log(JSON.stringify({ issues: allIssues, duration }, null, 2));
    return { issues: allIssues, duration };
  }

  if (allIssues.length === 0) {
    console.log(`✅ No shape mismatches found (${duration}ms)\n`);
    return { issues: allIssues, duration };
  }

  console.log(`⚠️  Found ${allIssues.length} potential issue(s):\n`);

  for (const issue of allIssues) {
    console.log(`   📄 ${issue.file}:${issue.line}`);
    console.log(`   ❌ ${issue.issue}`);
    console.log(`   📝 ${issue.code}`);

    if (options.fix) {
      console.log(`   ✅ Fix: ${issue.fix}`);
    }
    console.log('');
  }

  console.log(`Completed in ${duration}ms\n`);

  return { issues: allIssues, duration };
}

export default lint;
