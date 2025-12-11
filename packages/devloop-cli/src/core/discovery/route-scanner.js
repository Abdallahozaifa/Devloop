import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Scans for UI routes in various frontend frameworks
 * Supports: Next.js (App Router & Pages), React Router, Vue Router, SvelteKit, etc.
 */
export async function scanRoutes(projectRoot, framework) {
  const result = {
    routes: [],
    layouts: [],
    guards: [],
  };

  const frontendFramework = framework?.frontend;

  if (frontendFramework === 'nextjs') {
    const nextRoutes = await scanNextJsRoutes(projectRoot);
    mergeRoutes(result, nextRoutes);
  } else if (frontendFramework === 'nuxt') {
    const nuxtRoutes = await scanNuxtRoutes(projectRoot);
    mergeRoutes(result, nuxtRoutes);
  } else if (frontendFramework === 'svelte') {
    const svelteRoutes = await scanSvelteKitRoutes(projectRoot);
    mergeRoutes(result, svelteRoutes);
  } else if (frontendFramework === 'vue') {
    const vueRoutes = await scanVueRouterRoutes(projectRoot);
    mergeRoutes(result, vueRoutes);
  } else if (frontendFramework?.includes('react')) {
    const reactRoutes = await scanReactRouterRoutes(projectRoot);
    mergeRoutes(result, reactRoutes);
  }

  // Also try generic file-based route scanning
  const fileRoutes = await scanFileBasedRoutes(projectRoot);
  mergeRoutes(result, fileRoutes);

  return result;
}

function mergeRoutes(target, source) {
  if (source.routes) {
    for (const route of source.routes) {
      const existing = target.routes.find(r => r.path === route.path);
      if (!existing) {
        target.routes.push(route);
      }
    }
  }
  if (source.layouts) {
    target.layouts.push(...source.layouts);
  }
  if (source.guards) {
    target.guards.push(...source.guards);
  }
}

async function scanNextJsRoutes(projectRoot) {
  const result = { routes: [], layouts: [], guards: [] };

  // Check for App Router (Next.js 13+)
  const appDir = await findDir(projectRoot, ['app', 'src/app']);
  if (appDir) {
    const appRoutes = await scanNextAppRouter(projectRoot, appDir);
    mergeRoutes(result, appRoutes);
  }

  // Check for Pages Router
  const pagesDir = await findDir(projectRoot, ['pages', 'src/pages']);
  if (pagesDir) {
    const pageRoutes = await scanNextPagesRouter(projectRoot, pagesDir);
    mergeRoutes(result, pageRoutes);
  }

  return result;
}

async function scanNextAppRouter(projectRoot, appDir) {
  const result = { routes: [], layouts: [], guards: [] };

  const files = await glob('**/page.{tsx,jsx,ts,js}', {
    cwd: path.join(projectRoot, appDir),
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const routePath = filePathToRoute(file.replace(/\/page\.(tsx|jsx|ts|js)$/, ''));
    const filePath = path.join(appDir, file);
    const fullPath = path.join(projectRoot, filePath);

    const route = {
      path: routePath || '/',
      file: filePath,
      type: 'page',
      dynamic: routePath.includes('['),
      auth: await checkRouteAuth(fullPath, projectRoot, appDir),
    };

    // Check for dynamic segments
    if (route.dynamic) {
      route.params = extractDynamicParams(routePath);
    }

    result.routes.push(route);
  }

  // Find layouts
  const layoutFiles = await glob('**/layout.{tsx,jsx,ts,js}', {
    cwd: path.join(projectRoot, appDir),
    ignore: ['**/node_modules/**'],
  });

  for (const file of layoutFiles) {
    const layoutPath = filePathToRoute(file.replace(/\/layout\.(tsx|jsx|ts|js)$/, ''));
    result.layouts.push({
      path: layoutPath || '/',
      file: path.join(appDir, file),
    });
  }

  return result;
}

async function scanNextPagesRouter(projectRoot, pagesDir) {
  const result = { routes: [], layouts: [], guards: [] };

  const files = await glob('**/*.{tsx,jsx,ts,js}', {
    cwd: path.join(projectRoot, pagesDir),
    ignore: ['**/node_modules/**', '_app.*', '_document.*', 'api/**'],
  });

  for (const file of files) {
    const routePath = filePathToRoute(file.replace(/\.(tsx|jsx|ts|js)$/, ''));
    const filePath = path.join(pagesDir, file);
    const fullPath = path.join(projectRoot, filePath);

    const route = {
      path: routePath,
      file: filePath,
      type: 'page',
      dynamic: routePath.includes('['),
      auth: await checkRouteAuth(fullPath, projectRoot, pagesDir),
    };

    if (route.dynamic) {
      route.params = extractDynamicParams(routePath);
    }

    result.routes.push(route);
  }

  return result;
}

async function scanNuxtRoutes(projectRoot) {
  const result = { routes: [], layouts: [], guards: [] };

  const pagesDir = await findDir(projectRoot, ['pages', 'src/pages']);
  if (!pagesDir) return result;

  const files = await glob('**/*.vue', {
    cwd: path.join(projectRoot, pagesDir),
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const routePath = filePathToRoute(file.replace(/\.vue$/, ''));
    const filePath = path.join(pagesDir, file);

    result.routes.push({
      path: routePath,
      file: filePath,
      type: 'page',
      dynamic: routePath.includes('['),
      params: routePath.includes('[') ? extractDynamicParams(routePath) : undefined,
    });
  }

  return result;
}

async function scanSvelteKitRoutes(projectRoot) {
  const result = { routes: [], layouts: [], guards: [] };

  const routesDir = await findDir(projectRoot, ['src/routes']);
  if (!routesDir) return result;

  const files = await glob('**/+page.svelte', {
    cwd: path.join(projectRoot, routesDir),
    ignore: ['**/node_modules/**'],
  });

  for (const file of files) {
    const routePath = filePathToRoute(file.replace(/\/\+page\.svelte$/, ''));
    const filePath = path.join(routesDir, file);

    result.routes.push({
      path: routePath || '/',
      file: filePath,
      type: 'page',
      dynamic: routePath.includes('['),
      params: routePath.includes('[') ? extractDynamicParams(routePath) : undefined,
    });
  }

  // Find layouts
  const layoutFiles = await glob('**/+layout.svelte', {
    cwd: path.join(projectRoot, routesDir),
    ignore: ['**/node_modules/**'],
  });

  for (const file of layoutFiles) {
    const layoutPath = filePathToRoute(file.replace(/\/\+layout\.svelte$/, ''));
    result.layouts.push({
      path: layoutPath || '/',
      file: path.join(routesDir, file),
    });
  }

  return result;
}

async function scanVueRouterRoutes(projectRoot) {
  const result = { routes: [], layouts: [], guards: [] };

  // Find router config files
  const routerFiles = await glob('**/router/**/*.{ts,js}', {
    cwd: projectRoot,
    ignore: ['**/node_modules/**'],
  });

  for (const file of routerFiles) {
    const filePath = path.join(projectRoot, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse route definitions
    const routeRegex = /{\s*path:\s*['\"]([^'"]+)['"]\s*,\s*(?:name:\s*['\"](\w+)['"]\s*,\s*)?component:\s*(?:(\w+)|.*?import\s*\(['\"]([^'"]+)['\"]\))/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      const routePath = match[1];
      const routeName = match[2];
      const componentFile = match[4] || match[3];

      result.routes.push({
        path: routePath,
        name: routeName,
        component: componentFile,
        file,
        type: 'page',
        dynamic: routePath.includes(':'),
        params: routePath.includes(':') ? extractVueParams(routePath) : undefined,
      });
    }

    // Check for navigation guards
    if (content.includes('beforeEach') || content.includes('beforeEnter')) {
      result.guards.push({
        file,
        type: content.includes('beforeEach') ? 'global' : 'route',
      });
    }
  }

  return result;
}

async function scanReactRouterRoutes(projectRoot) {
  const result = { routes: [], layouts: [], guards: [] };

  // Find route configuration files
  const routeFiles = await glob('**/{routes,router,App,routing}*.{tsx,jsx,ts,js}', {
    cwd: projectRoot,
    ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
  });

  for (const file of routeFiles) {
    const filePath = path.join(projectRoot, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Parse <Route> components
    const routeRegex = /<Route\s+(?:[^>]*\s+)?path=(?:['\"]|{['"])([^'"]+)(?:['\"]|['"]})(?:\s+[^>]*)?(?:element|component)=(?:['\"{]|{<)(\w+)/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      const routePath = match[1];
      const component = match[2];

      result.routes.push({
        path: routePath,
        component,
        file,
        type: 'page',
        dynamic: routePath.includes(':'),
        params: routePath.includes(':') ? extractVueParams(routePath) : undefined,
      });
    }

    // Parse createBrowserRouter routes
    const browserRouterRegex = /{\s*path:\s*['\"]([^'"]+)['"]\s*,\s*element:\s*<(\w+)/g;
    while ((match = browserRouterRegex.exec(content)) !== null) {
      const routePath = match[1];
      const component = match[2];

      result.routes.push({
        path: routePath,
        component,
        file,
        type: 'page',
        dynamic: routePath.includes(':'),
        params: routePath.includes(':') ? extractVueParams(routePath) : undefined,
      });
    }

    // Check for ProtectedRoute patterns
    if (content.includes('ProtectedRoute') || content.includes('PrivateRoute') || content.includes('AuthRoute')) {
      result.guards.push({
        file,
        type: 'route-wrapper',
      });
    }
  }

  return result;
}

async function scanFileBasedRoutes(projectRoot) {
  const result = { routes: [], layouts: [], guards: [] };

  // Look for common page directories
  const pageDirs = ['pages', 'src/pages', 'app', 'src/app', 'views', 'src/views'];

  for (const dir of pageDirs) {
    const fullDir = path.join(projectRoot, dir);
    if (!fs.existsSync(fullDir)) continue;

    const files = await glob('**/*.{tsx,jsx,vue,svelte}', {
      cwd: fullDir,
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/components/**'],
    });

    for (const file of files) {
      // Skip layout/template files
      if (file.includes('layout') || file.includes('template') || file.includes('_app')) continue;

      const routePath = filePathToRoute(file.replace(/\.(tsx|jsx|vue|svelte)$/, ''));
      const filePath = path.join(dir, file);
      const fullPath = path.join(projectRoot, filePath);

      // Check if this looks like a page component
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!looksLikePage(content, file)) continue;

      const existingRoute = result.routes.find(r => r.path === routePath);
      if (existingRoute) continue;

      result.routes.push({
        path: routePath || '/',
        file: filePath,
        type: 'page',
        dynamic: routePath.includes('['),
        params: routePath.includes('[') ? extractDynamicParams(routePath) : undefined,
      });
    }
  }

  return result;
}

function looksLikePage(content, fileName) {
  // Check if file looks like a page component
  const pageIndicators = [
    /export\s+default\s+function\s+\w*Page/i,
    /export\s+default\s+class\s+\w*Page/i,
    /const\s+\w*Page\s*=/i,
    /<template>[\s\S]*<\/template>/,
    /<script[\s\S]*<\/script>/,
    /useRouter|useNavigate|useLocation/,
    /getServerSideProps|getStaticProps|getStaticPaths/,
  ];

  const hasPageIndicator = pageIndicators.some(pattern => pattern.test(content));
  const fileNameIndicator = /page|view|screen/i.test(fileName);

  return hasPageIndicator || fileNameIndicator;
}

async function checkRouteAuth(filePath, projectRoot, baseDir) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for common auth patterns
    const authPatterns = [
      /useAuth\s*\(/,
      /useSession\s*\(/,
      /getServerSession/,
      /requireAuth/,
      /isAuthenticated/,
      /ProtectedRoute/,
      /withAuth/,
      /authOptions/,
      /redirect.*login/i,
      /redirect.*signin/i,
    ];

    const hasAuth = authPatterns.some(pattern => pattern.test(content));
    if (hasAuth) return true;

    // Check for middleware
    const routeDir = path.dirname(filePath);
    const middlewarePath = path.join(routeDir, 'middleware.ts');
    const middlewarePathJs = path.join(routeDir, 'middleware.js');

    if (fs.existsSync(middlewarePath) || fs.existsSync(middlewarePathJs)) {
      return true;
    }

    // Check parent layouts for auth
    let currentDir = path.dirname(filePath);
    while (currentDir.startsWith(path.join(projectRoot, baseDir))) {
      const layoutPath = path.join(currentDir, 'layout.tsx');
      const layoutPathJs = path.join(currentDir, 'layout.js');

      const layoutFile = fs.existsSync(layoutPath) ? layoutPath : (fs.existsSync(layoutPathJs) ? layoutPathJs : null);

      if (layoutFile) {
        const layoutContent = fs.readFileSync(layoutFile, 'utf8');
        const hasLayoutAuth = authPatterns.some(pattern => pattern.test(layoutContent));
        if (hasLayoutAuth) return true;
      }

      currentDir = path.dirname(currentDir);
    }

    return false;
  } catch {
    return false;
  }
}

function filePathToRoute(filePath) {
  let route = '/' + filePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/index$/, '')
    .replace(/\[\.\.\.(\w+)\]/g, '*') // Catch-all routes
    .replace(/\[(\w+)\]/g, ':$1'); // Dynamic segments

  // Clean up route
  route = route.replace(/\/+/g, '/');
  if (route === '') route = '/';

  return route;
}

function extractDynamicParams(routePath) {
  const params = [];

  // Match [param] style (Next.js, Nuxt)
  const bracketMatches = routePath.matchAll(/\[(\w+)\]/g);
  for (const match of bracketMatches) {
    params.push({
      name: match[1],
      type: match[1].toLowerCase().includes('id') ? 'uuid' : 'string',
    });
  }

  // Match :param style (React Router, Vue Router)
  const colonMatches = routePath.matchAll(/:(\w+)/g);
  for (const match of colonMatches) {
    const existing = params.find(p => p.name === match[1]);
    if (!existing) {
      params.push({
        name: match[1],
        type: match[1].toLowerCase().includes('id') ? 'uuid' : 'string',
      });
    }
  }

  return params;
}

function extractVueParams(routePath) {
  const params = [];
  const matches = routePath.matchAll(/:(\w+)/g);

  for (const match of matches) {
    params.push({
      name: match[1],
      type: match[1].toLowerCase().includes('id') ? 'uuid' : 'string',
    });
  }

  return params;
}

async function findDir(projectRoot, candidates) {
  for (const dir of candidates) {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      return dir;
    }
  }
  return null;
}

export default { scanRoutes };
