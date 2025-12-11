/**
 * Generates UI tests from discovered routes
 */
export function generateUiTests(discovery) {
  const tests = [];
  const { routes } = discovery.ui || {};
  const { auth } = discovery;

  if (!routes?.length) {
    return tests;
  }

  // Group routes by auth requirement
  const publicRoutes = routes.filter(r => !r.auth);
  const protectedRoutes = routes.filter(r => r.auth);

  // Generate smoke tests for all public routes
  for (const route of publicRoutes) {
    tests.push(generatePageLoadTest(route));
  }

  // Generate auth flow test for protected routes
  if (protectedRoutes.length > 0 && auth?.loginEndpoint) {
    tests.push(generateAuthFlowTest(auth, protectedRoutes));
  }

  // Generate tests for individual protected routes
  for (const route of protectedRoutes) {
    tests.push(generateProtectedPageTest(route, auth));
  }

  // Generate navigation tests
  const navTests = generateNavigationTests(routes);
  tests.push(...navTests);

  return tests;
}

function generatePageLoadTest(route) {
  return {
    name: `Page Load: ${route.path}`,
    type: 'ui',
    route: route.path,
    file: route.file,
    auth: false,
    steps: [
      {
        action: 'navigate',
        url: route.path,
      },
      {
        action: 'waitForLoad',
      },
      {
        action: 'checkNoErrors',
      },
      {
        action: 'checkVisible',
        selectors: getDefaultSelectors(),
      },
    ],
    expect: {
      noConsoleErrors: true,
      loadTime: 3000,
    },
  };
}

function generateProtectedPageTest(route, auth) {
  const test = {
    name: `Protected Page: ${route.path}`,
    type: 'ui',
    route: route.path,
    file: route.file,
    auth: true,
    steps: [],
    expect: {
      noConsoleErrors: true,
    },
  };

  // First check redirect to login without auth
  test.steps.push({
    action: 'navigate',
    url: route.path,
  });
  test.steps.push({
    action: 'waitForRedirect',
    expectedUrl: '/login',
  });

  // Then authenticate
  test.steps.push({
    action: 'login',
    credentials: auth.credentialFields,
  });

  // Navigate back to protected page
  test.steps.push({
    action: 'navigate',
    url: route.path,
  });
  test.steps.push({
    action: 'waitForLoad',
  });
  test.steps.push({
    action: 'checkVisible',
    selectors: getDefaultSelectors(),
  });

  return test;
}

function generateAuthFlowTest(auth, protectedRoutes) {
  const test = {
    name: 'Authentication Flow',
    type: 'ui_flow',
    steps: [],
    expect: {
      noConsoleErrors: true,
    },
  };

  // Step 1: Visit login page
  test.steps.push({
    name: 'Visit login page',
    action: 'navigate',
    url: '/login',
  });
  test.steps.push({
    action: 'waitForLoad',
  });

  // Step 2: Fill credentials
  test.steps.push({
    name: 'Fill credentials',
    action: 'fill',
    fields: generateCredentialFields(auth.credentialFields),
  });

  // Step 3: Submit form
  test.steps.push({
    name: 'Submit login form',
    action: 'click',
    selector: 'button[type="submit"], button:has-text("Login"), button:has-text("Sign in")',
  });

  // Step 4: Wait for redirect
  test.steps.push({
    name: 'Wait for redirect to dashboard',
    action: 'waitForNavigation',
  });

  // Step 5: Verify logged in state
  test.steps.push({
    name: 'Verify logged in',
    action: 'checkVisible',
    selectors: ['[data-testid="user-menu"]', '.user-avatar', '.logout-button', 'nav'],
  });

  // Step 6: Access protected route
  if (protectedRoutes.length > 0) {
    const firstProtected = protectedRoutes[0];
    test.steps.push({
      name: `Access protected route: ${firstProtected.path}`,
      action: 'navigate',
      url: firstProtected.path,
    });
    test.steps.push({
      action: 'checkNoRedirect',
    });
  }

  // Step 7: Logout
  if (auth.logoutEndpoint) {
    test.steps.push({
      name: 'Logout',
      action: 'click',
      selector: '.logout-button, [data-testid="logout"], button:has-text("Logout"), button:has-text("Sign out")',
    });
    test.steps.push({
      action: 'waitForNavigation',
    });
  }

  return test;
}

function generateNavigationTests(routes) {
  const tests = [];

  // Group routes by sections
  const routesBySection = {};
  for (const route of routes) {
    const section = route.path.split('/')[1] || 'root';
    if (!routesBySection[section]) {
      routesBySection[section] = [];
    }
    routesBySection[section].push(route);
  }

  // Generate navigation flow test for each section
  for (const [section, sectionRoutes] of Object.entries(routesBySection)) {
    if (sectionRoutes.length < 2) continue;

    const test = {
      name: `Navigation: ${section} section`,
      type: 'ui_navigation',
      section,
      steps: [],
      expect: {
        noConsoleErrors: true,
      },
    };

    // Navigate through each route in the section
    for (let i = 0; i < Math.min(sectionRoutes.length, 5); i++) {
      const route = sectionRoutes[i];
      test.steps.push({
        name: `Navigate to ${route.path}`,
        action: 'navigate',
        url: route.path,
      });
      test.steps.push({
        action: 'waitForLoad',
      });
    }

    tests.push(test);
  }

  return tests;
}

function generateCredentialFields(credentialFields = ['email', 'password']) {
  const fields = [];

  for (const field of credentialFields) {
    const fieldLower = field.toLowerCase();
    let selector, value;

    if (fieldLower.includes('email')) {
      selector = 'input[type="email"], input[name="email"], input[id="email"]';
      value = 'test@devloop-test.com';
    } else if (fieldLower.includes('password')) {
      selector = 'input[type="password"], input[name="password"], input[id="password"]';
      value = 'TestPassword123!';
    } else if (fieldLower.includes('username')) {
      selector = 'input[name="username"], input[id="username"]';
      value = 'testuser';
    } else {
      selector = `input[name="${field}"], input[id="${field}"]`;
      value = 'test-value';
    }

    fields.push({ selector, value, field });
  }

  return fields;
}

function getDefaultSelectors() {
  return [
    'body',
    'main, [role="main"], #main, .main-content',
    'header, nav, [role="navigation"]',
  ];
}

/**
 * Generate form tests
 */
export function generateFormTests(discovery) {
  const tests = [];
  const { routes } = discovery.ui || {};
  const { auth } = discovery;

  // Find routes that likely contain forms
  const formRoutes = routes?.filter(r => {
    const pathLower = r.path.toLowerCase();
    return pathLower.includes('new') ||
      pathLower.includes('create') ||
      pathLower.includes('edit') ||
      pathLower.includes('settings') ||
      pathLower.includes('profile');
  }) || [];

  for (const route of formRoutes) {
    tests.push(generateFormSubmissionTest(route));
  }

  // Generate login form test
  if (auth?.credentialFields?.length) {
    tests.push(generateLoginFormTest(auth));
  }

  // Generate registration form test
  if (auth?.registerEndpoint) {
    tests.push(generateRegistrationFormTest(auth));
  }

  return tests;
}

function generateFormSubmissionTest(route) {
  return {
    name: `Form: ${route.path}`,
    type: 'ui_form',
    route: route.path,
    steps: [
      {
        action: 'navigate',
        url: route.path,
      },
      {
        action: 'waitForLoad',
      },
      {
        action: 'fillForm',
        strategy: 'auto', // Will detect form fields and fill appropriately
      },
      {
        action: 'submitForm',
      },
      {
        action: 'waitForNavigation',
        timeout: 5000,
      },
    ],
    expect: {
      noConsoleErrors: true,
      formSubmitted: true,
    },
  };
}

function generateLoginFormTest(auth) {
  return {
    name: 'Login Form Validation',
    type: 'ui_form',
    route: '/login',
    steps: [
      {
        action: 'navigate',
        url: '/login',
      },
      {
        action: 'waitForLoad',
      },
      // Test empty submission
      {
        name: 'Test empty submission',
        action: 'click',
        selector: 'button[type="submit"]',
      },
      {
        action: 'checkVisible',
        selectors: ['.error, .validation-error, [role="alert"]'],
      },
      // Test invalid email
      {
        name: 'Test invalid email',
        action: 'fill',
        fields: [
          { selector: 'input[type="email"]', value: 'invalid-email' },
          { selector: 'input[type="password"]', value: 'password123' },
        ],
      },
      {
        action: 'click',
        selector: 'button[type="submit"]',
      },
      {
        action: 'checkVisible',
        selectors: ['.error, .validation-error, [role="alert"]'],
      },
      // Test valid submission
      {
        name: 'Test valid credentials',
        action: 'clear',
      },
      {
        action: 'fill',
        fields: generateCredentialFields(auth.credentialFields),
      },
      {
        action: 'click',
        selector: 'button[type="submit"]',
      },
      {
        action: 'waitForNavigation',
      },
    ],
    expect: {
      noConsoleErrors: true,
    },
  };
}

function generateRegistrationFormTest(auth) {
  return {
    name: 'Registration Form',
    type: 'ui_form',
    route: '/register',
    steps: [
      {
        action: 'navigate',
        url: '/register',
      },
      {
        action: 'waitForLoad',
      },
      {
        action: 'fill',
        fields: [
          ...generateCredentialFields(auth.credentialFields),
          { selector: 'input[name="name"], input[name="fullName"]', value: 'Test User' },
        ],
      },
      {
        action: 'click',
        selector: 'button[type="submit"]',
      },
      {
        action: 'waitForNavigation',
        timeout: 5000,
      },
    ],
    expect: {
      noConsoleErrors: true,
      formSubmitted: true,
    },
  };
}

export default {
  generateUiTests,
  generateFormTests,
};
