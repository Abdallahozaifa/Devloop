import fs from 'fs';
import path from 'path';
import { registerFramework } from './framework-registry.js';

/**
 * React Framework Generator
 *
 * Generates TypeScript/JavaScript code for React applications:
 * - React components
 * - API hooks (React Query)
 * - TypeScript types
 */

const REACT_CONFIG = {
  detect: (projectDir) => {
    const packageJson = path.join(projectDir, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        const content = fs.readFileSync(packageJson, 'utf-8');
        const pkg = JSON.parse(content);
        return !!(pkg.dependencies?.react || pkg.devDependencies?.react);
      } catch (e) {
        return false;
      }
    }

    // Also check for apps/web/package.json (monorepo)
    const webPackageJson = path.join(projectDir, 'apps', 'web', 'package.json');
    if (fs.existsSync(webPackageJson)) {
      try {
        const content = fs.readFileSync(webPackageJson, 'utf-8');
        const pkg = JSON.parse(content);
        return !!(pkg.dependencies?.react || pkg.devDependencies?.react);
      } catch (e) {
        return false;
      }
    }

    return false;
  },

  generator: {
    /**
     * Generate React component from spec
     */
    generateComponent: (componentName, componentSpec) => {
      const propsInterface = generatePropsInterface(componentName, componentSpec.props);
      const stateHooks = generateStateHooks(componentSpec.state);
      const apiHooks = generateApiHookImports(componentSpec.apiCalls);

      return `import React, { useState, useEffect } from 'react';
${apiHooks}

${propsInterface}

export function ${componentName}({ ${Object.keys(componentSpec.props || {}).join(', ')} }: ${componentName}Props) {
  ${stateHooks}

  // TODO: Implement based on spec behavior:
  ${(componentSpec.behavior || []).map(b => `// - ${b}`).join('\n  ')}

  return (
    <div data-testid="${componentName.toLowerCase()}">
      {/* ${componentSpec.description || componentName} */}
    </div>
  );
}

export default ${componentName};
`;
    },

    /**
     * Generate API hook from spec endpoint
     */
    generateApiHook: (endpointSpec) => {
      const [method, urlPath] = endpointSpec.endpoint.split(' ');
      const resourceName = extractResourceName(urlPath);
      const hookName = generateHookName(method, resourceName);

      if (method === 'GET') {
        // Check if it's a list or single item
        const isList = !urlPath.includes('{id}') && !urlPath.includes('/:id');

        if (isList) {
          return `
export function use${resourceName}List(params?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['${resourceName.toLowerCase()}', params],
    queryFn: async () => {
      const response = await api.get('${urlPath}', { params });
      return response.data;
    }
  });
}
`;
        } else {
          const idParam = urlPath.includes('{') ? urlPath.match(/{(\w+)}/)?.[1] : 'id';
          return `
export function use${resourceName}(${idParam}: string) {
  return useQuery({
    queryKey: ['${resourceName.toLowerCase()}', ${idParam}],
    queryFn: async () => {
      const response = await api.get(\`${urlPath.replace(/{(\w+)}/g, '${$1}')}\`);
      return response.data;
    },
    enabled: !!${idParam}
  });
}
`;
        }
      } else if (method === 'POST') {
        return `
export function useCreate${resourceName}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Create${resourceName}Input) => {
      const response = await api.post('${urlPath}', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['${resourceName.toLowerCase()}'] });
    }
  });
}
`;
      } else if (method === 'PATCH' || method === 'PUT') {
        const idParam = urlPath.includes('{') ? urlPath.match(/{(\w+)}/)?.[1] : 'id';
        return `
export function useUpdate${resourceName}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ${idParam}, data }: { ${idParam}: string; data: Update${resourceName}Input }) => {
      const response = await api.${method.toLowerCase()}(\`${urlPath.replace(/{(\w+)}/g, '${$1}')}\`, data);
      return response.data;
    },
    onSuccess: (_, { ${idParam} }) => {
      queryClient.invalidateQueries({ queryKey: ['${resourceName.toLowerCase()}', ${idParam}] });
      queryClient.invalidateQueries({ queryKey: ['${resourceName.toLowerCase()}'] });
    }
  });
}
`;
      } else if (method === 'DELETE') {
        const idParam = urlPath.includes('{') ? urlPath.match(/{(\w+)}/)?.[1] : 'id';
        return `
export function useDelete${resourceName}() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (${idParam}: string) => {
      await api.delete(\`${urlPath.replace(/{(\w+)}/g, '${$1}')}\`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['${resourceName.toLowerCase()}'] });
    }
  });
}
`;
      }

      return '';
    },

    /**
     * Generate TypeScript types from spec model
     */
    generateTypes: (modelName, modelSpec) => {
      const fields = [];

      for (const [fieldName, fieldSpec] of Object.entries(modelSpec.fields)) {
        const tsType = mapToTypeScript(fieldSpec.type, fieldSpec);
        const optional = !fieldSpec.required && !fieldSpec.generated ? '?' : '';
        fields.push(`  ${fieldName}${optional}: ${tsType};`);
      }

      // Generate create input type (excludes generated fields)
      const createFields = Object.entries(modelSpec.fields)
        .filter(([_, spec]) => !spec.generated)
        .map(([name, spec]) => {
          const tsType = mapToTypeScript(spec.type, spec);
          const optional = !spec.required ? '?' : '';
          return `  ${name}${optional}: ${tsType};`;
        });

      // Generate update input type (all optional)
      const updateFields = Object.entries(modelSpec.fields)
        .filter(([_, spec]) => !spec.generated)
        .map(([name, spec]) => {
          const tsType = mapToTypeScript(spec.type, spec);
          return `  ${name}?: ${tsType};`;
        });

      return `export interface ${modelName} {
${fields.join('\n')}
}

export interface Create${modelName}Input {
${createFields.join('\n')}
}

export interface Update${modelName}Input {
${updateFields.join('\n')}
}
`;
    }
  },

  contractPatterns: {
    // Patterns to detect API calls in React
    fetchCall: /fetch\(['"]([^'"]+)['"]/g,
    axiosCall: /api\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/gi,
    useQueryKey: /queryKey:\s*\[['"]([^'"]+)['"]/g,
    apiEndpoint: /['"]\/api\/v\d+\/[^'"]+['"]/g
  },

  filePaths: {
    components: 'apps/web/src/components/',
    pages: 'apps/web/src/pages/',
    hooks: 'apps/web/src/hooks/',
    api: 'apps/web/src/api/',
    types: 'apps/web/src/types/'
  }
};

/**
 * Map universal types to TypeScript types
 */
function mapToTypeScript(type, fieldSpec = {}) {
  const mapping = {
    uuid: 'string',
    string: 'string',
    int: 'number',
    decimal: 'number',
    boolean: 'boolean',
    datetime: 'string',
    date: 'string',
    email: 'string',
    url: 'string',
    json: 'Record<string, unknown>',
    object: 'Record<string, unknown>',
    array: 'unknown[]'
  };

  // Handle enum
  if (type === 'enum' && fieldSpec.values) {
    return fieldSpec.values.map(v => `'${v}'`).join(' | ');
  }

  // Handle array with 'of' type
  if (type === 'array' && fieldSpec.of) {
    return `${fieldSpec.of}[]`;
  }

  return mapping[type] || 'unknown';
}

/**
 * Generate props interface
 */
function generatePropsInterface(componentName, props) {
  if (!props || Object.keys(props).length === 0) {
    return `interface ${componentName}Props {}`;
  }

  const propLines = Object.entries(props).map(([name, type]) => {
    const tsType = typeof type === 'string' ? type : mapToTypeScript(type);
    return `  ${name}: ${tsType};`;
  });

  return `interface ${componentName}Props {
${propLines.join('\n')}
}`;
}

/**
 * Generate useState hooks for component state
 */
function generateStateHooks(state) {
  if (!state || Object.keys(state).length === 0) {
    return '';
  }

  return Object.entries(state).map(([name, type]) => {
    const tsType = typeof type === 'string' ? type : mapToTypeScript(type);
    const defaultValue = getDefaultValue(tsType);
    return `const [${name}, set${capitalize(name)}] = useState<${tsType}>(${defaultValue});`;
  }).join('\n  ');
}

/**
 * Generate API hook imports based on apiCalls
 */
function generateApiHookImports(apiCalls) {
  if (!apiCalls || apiCalls.length === 0) {
    return "import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';";
  }

  const hookNames = apiCalls.map(call => {
    const [method, path] = call.split(' ');
    const resource = extractResourceName(path);
    return generateHookName(method, resource);
  });

  return `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ${hookNames.join(', ')} } from '../hooks/api';`;
}

/**
 * Extract resource name from URL path
 */
function extractResourceName(urlPath) {
  const parts = urlPath.split('/').filter(p => p && !p.startsWith('{') && !p.startsWith(':') && p !== 'api' && !p.match(/^v\d+$/));
  const lastPart = parts[parts.length - 1] || 'Resource';
  return capitalize(lastPart.replace(/s$/, '')); // Singularize
}

/**
 * Generate hook name from method and resource
 */
function generateHookName(method, resource) {
  const prefixes = {
    GET: 'use',
    POST: 'useCreate',
    PUT: 'useUpdate',
    PATCH: 'useUpdate',
    DELETE: 'useDelete'
  };
  return `${prefixes[method] || 'use'}${resource}`;
}

/**
 * Get default value for a TypeScript type
 */
function getDefaultValue(type) {
  if (type === 'string') return "''";
  if (type === 'number') return '0';
  if (type === 'boolean') return 'false';
  if (type.endsWith('[]')) return '[]';
  if (type.includes('|')) return 'null';
  return 'null';
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Register React
registerFramework('react', REACT_CONFIG);

export default REACT_CONFIG;
