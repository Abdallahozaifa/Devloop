/**
 * Auto-Fixer Module for DevLoop QA
 *
 * Diagnoses common production issues and applies fixes automatically.
 * Supports multiple platforms (Fly.io, Vercel, generic).
 */

import { execSync, spawn } from 'child_process';
import chalk from 'chalk';

/**
 * Known fixes database with symptoms, diagnosis, and platform-specific solutions
 */
const KNOWN_FIXES = {
  'public_endpoint_403': {
    name: 'Public Endpoint Returns 403',
    symptoms: ['403', 'Forbidden', 'public endpoint', 'CORS'],
    description: 'Public endpoints should not require authentication but are returning 403',

    diagnose: async (context) => {
      const diagnosis = {
        issue: 'public_endpoint_403',
        confidence: 0,
        details: [],
        suggestedFix: null
      };

      // Check if it's a CORS issue
      if (context.error?.includes('CORS') || context.headers?.['access-control-allow-origin'] === undefined) {
        diagnosis.confidence = 85;
        diagnosis.details.push('Missing or incorrect CORS headers detected');
        diagnosis.suggestedFix = 'cors_fix';
      }

      // Check if auth middleware is incorrectly applied
      if (context.response?.status === 403 && context.endpoint?.includes('/auth/')) {
        diagnosis.confidence = Math.max(diagnosis.confidence, 75);
        diagnosis.details.push('Auth endpoint returning 403 - may have auth middleware on public route');
        diagnosis.suggestedFix = diagnosis.suggestedFix || 'auth_middleware_fix';
      }

      // Check response body for clues
      if (context.responseBody?.detail?.includes('CORS') || context.responseBody?.message?.includes('origin')) {
        diagnosis.confidence = 90;
        diagnosis.details.push('Response indicates CORS origin not allowed');
        diagnosis.suggestedFix = 'cors_fix';
      }

      return diagnosis;
    },

    fixes: {
      'cors_fix': {
        description: 'Add frontend URL to CORS_ORIGINS',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Applying CORS fix for Fly.io...'));

            // Get current origins
            let currentOrigins = [];
            try {
              const secretsOutput = execSync(`fly secrets list -a ${context.appName} 2>/dev/null`, { encoding: 'utf8' });
              if (secretsOutput.includes('CORS_ORIGINS')) {
                // Try to get current value (this won't show the value, just that it exists)
                console.log(chalk.dim('  CORS_ORIGINS secret exists, will update it'));
              }
            } catch (e) {
              console.log(chalk.dim('  No existing CORS_ORIGINS secret found'));
            }

            // Build new origins list - use context from the project being fixed
            const originsToAdd = [
              context.frontendUrl,
              context.apiUrl,
              'http://localhost:3000',
              'http://localhost:5173'
            ].filter(Boolean);

            const originsJson = JSON.stringify(originsToAdd);

            console.log(chalk.dim(`  Setting CORS_ORIGINS to: ${originsJson}`));

            try {
              execSync(`fly secrets set CORS_ORIGINS='${originsJson}' -a ${context.appName}`, {
                stdio: 'inherit',
                timeout: 60000
              });
              return { success: true, message: 'CORS_ORIGINS updated successfully' };
            } catch (e) {
              return { success: false, message: `Failed to set secret: ${e.message}` };
            }
          },

          'vercel': async (context) => {
            console.log(chalk.cyan('\n  Applying CORS fix for Vercel...'));
            console.log(chalk.yellow('  Manual step required:'));
            console.log(chalk.dim('  1. Go to Vercel Dashboard → Project → Settings → Environment Variables'));
            console.log(chalk.dim('  2. Add/Update CORS_ORIGINS with your frontend URLs'));
            console.log(chalk.dim('  3. Redeploy the project'));
            return { success: false, message: 'Manual configuration required for Vercel', manual: true };
          },

          'generic': async (context) => {
            console.log(chalk.cyan('\n  CORS fix instructions:'));
            console.log(chalk.dim('  1. Update your CORS configuration to include the frontend origin'));
            console.log(chalk.dim('  2. Ensure CORS_ORIGINS environment variable includes:'));
            console.log(chalk.dim(`     - ${context.frontendUrl || 'your-frontend-url'}`));
            console.log(chalk.dim('  3. Restart/redeploy your application'));
            return { success: false, message: 'Manual configuration required', manual: true };
          }
        }
      },

      'auth_middleware_fix': {
        description: 'Check auth middleware configuration',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Auth middleware issue detected'));
            console.log(chalk.yellow('  This requires code changes:'));
            console.log(chalk.dim('  1. Check that public routes (/auth/login, /auth/magic-link, /health) are excluded from auth middleware'));
            console.log(chalk.dim('  2. Verify route ordering - public routes should be defined before auth middleware'));
            return { success: false, message: 'Code review required', manual: true };
          },
          'vercel': async (context) => {
            return { success: false, message: 'Code review required', manual: true };
          },
          'generic': async (context) => {
            return { success: false, message: 'Code review required', manual: true };
          }
        }
      }
    }
  },

  'db_connection_error': {
    name: 'Database Connection Error',
    symptoms: ['connection', 'database', 'postgres', 'pool', 'closed', 'timeout', 'ConnectionDoesNotExistError'],
    description: 'Database connections are failing or timing out',

    diagnose: async (context) => {
      const diagnosis = {
        issue: 'db_connection_error',
        confidence: 0,
        details: [],
        suggestedFix: null
      };

      const errorStr = (context.error || context.responseBody?.detail || '').toLowerCase();

      if (errorStr.includes('connection') && errorStr.includes('closed')) {
        diagnosis.confidence = 90;
        diagnosis.details.push('Connection was closed unexpectedly - likely pool exhaustion or proxy timeout');
        diagnosis.suggestedFix = 'pool_fix';
      }

      if (errorStr.includes('timeout')) {
        diagnosis.confidence = Math.max(diagnosis.confidence, 80);
        diagnosis.details.push('Database connection timeout detected');
        diagnosis.suggestedFix = diagnosis.suggestedFix || 'pool_fix';
      }

      if (errorStr.includes('too many connections') || errorStr.includes('pool')) {
        diagnosis.confidence = 95;
        diagnosis.details.push('Connection pool exhausted');
        diagnosis.suggestedFix = 'pool_fix';
      }

      if (errorStr.includes('memory') || context.responseBody?.detail?.includes('OOM')) {
        diagnosis.confidence = 85;
        diagnosis.details.push('Possible memory issue affecting database operations');
        diagnosis.suggestedFix = 'memory_fix';
      }

      return diagnosis;
    },

    fixes: {
      'pool_fix': {
        description: 'Optimize database connection pooling',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Applying database pool fix for Fly.io...'));
            console.log(chalk.dim('  Recommendation: Use NullPool with Fly.io Postgres'));
            console.log(chalk.dim('  Fly\'s proxy manages connections - disable app-level pooling'));
            console.log();
            console.log(chalk.yellow('  Code change needed in your SQLAlchemy config:'));
            console.log(chalk.dim(`
    from sqlalchemy.pool import NullPool

    engine = create_async_engine(
        DATABASE_URL,
        poolclass=NullPool,  # Disable pooling - Fly's proxy handles it
    )`));
            return { success: false, message: 'Code change required - use NullPool', manual: true };
          },
          'vercel': async (context) => {
            console.log(chalk.cyan('\n  Database connection fix for serverless:'));
            console.log(chalk.dim('  1. Use connection pooling service (e.g., PgBouncer, Supabase pooler)'));
            console.log(chalk.dim('  2. Set pool_size=1 for serverless'));
            console.log(chalk.dim('  3. Enable pool_pre_ping=True'));
            return { success: false, message: 'Configuration change required', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.cyan('\n  Database connection recommendations:'));
            console.log(chalk.dim('  1. Reduce pool_size if connections are being exhausted'));
            console.log(chalk.dim('  2. Add pool_recycle=300 to recycle stale connections'));
            console.log(chalk.dim('  3. Enable pool_pre_ping=True to test connections before use'));
            return { success: false, message: 'Configuration change required', manual: true };
          }
        }
      },

      'memory_fix': {
        description: 'Increase application memory',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Scaling up Fly.io machine...'));
            try {
              execSync(`fly scale memory 512 -a ${context.appName}`, { stdio: 'inherit', timeout: 60000 });
              return { success: true, message: 'Memory scaled to 512MB' };
            } catch (e) {
              console.log(chalk.yellow('  Could not auto-scale. Run manually:'));
              console.log(chalk.dim(`  fly scale memory 512 -a ${context.appName}`));
              return { success: false, message: 'Manual scaling required' };
            }
          },
          'vercel': async (context) => {
            console.log(chalk.yellow('  Vercel memory is managed per-function'));
            console.log(chalk.dim('  Upgrade to Pro plan for higher memory limits'));
            return { success: false, message: 'Plan upgrade may be required', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Increase container/server memory allocation'));
            return { success: false, message: 'Manual configuration required', manual: true };
          }
        }
      }
    }
  },

  'internal_server_error': {
    name: 'Internal Server Error (500)',
    symptoms: ['500', 'Internal Server Error', 'internal error', 'server error'],
    description: 'Server is returning 500 errors',

    diagnose: async (context) => {
      const diagnosis = {
        issue: 'internal_server_error',
        confidence: 0,
        details: [],
        suggestedFix: null
      };

      // Check if it's a specific error
      const errorStr = (context.error || context.responseBody?.detail || '').toLowerCase();

      if (errorStr.includes('database') || errorStr.includes('postgres') || errorStr.includes('sql')) {
        diagnosis.confidence = 85;
        diagnosis.details.push('Database-related error detected');
        diagnosis.suggestedFix = 'check_db';
      } else if (errorStr.includes('import') || errorStr.includes('module')) {
        diagnosis.confidence = 80;
        diagnosis.details.push('Module import error - possible missing dependency');
        diagnosis.suggestedFix = 'check_deps';
      } else if (errorStr.includes('env') || errorStr.includes('config') || errorStr.includes('secret')) {
        diagnosis.confidence = 80;
        diagnosis.details.push('Configuration or environment variable issue');
        diagnosis.suggestedFix = 'check_env';
      } else {
        diagnosis.confidence = 50;
        diagnosis.details.push('Generic 500 error - check application logs');
        diagnosis.suggestedFix = 'check_logs';
      }

      return diagnosis;
    },

    fixes: {
      'check_logs': {
        description: 'Check application logs for error details',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Fetching recent logs from Fly.io...'));
            try {
              console.log(chalk.dim('  Last 50 log entries:\n'));
              execSync(`fly logs -a ${context.appName} -n 50`, { stdio: 'inherit', timeout: 30000 });
              return { success: true, message: 'Logs retrieved - check above for error details' };
            } catch (e) {
              console.log(chalk.yellow(`  Run manually: fly logs -a ${context.appName}`));
              return { success: false, message: 'Could not fetch logs automatically' };
            }
          },
          'vercel': async (context) => {
            console.log(chalk.cyan('\n  Check Vercel logs:'));
            console.log(chalk.dim('  1. Go to Vercel Dashboard → Project → Deployments'));
            console.log(chalk.dim('  2. Click on the latest deployment → Functions tab'));
            console.log(chalk.dim('  3. Review function logs for errors'));
            return { success: false, message: 'Check Vercel dashboard for logs', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Check your application logs for the full error stack trace'));
            return { success: false, message: 'Manual log review required', manual: true };
          }
        }
      },

      'check_db': {
        description: 'Verify database connectivity',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Checking Fly.io Postgres status...'));
            try {
              execSync(`fly postgres connect -a ${context.appName}-db -c "SELECT 1"`, {
                stdio: 'inherit',
                timeout: 30000
              });
              console.log(chalk.green('  Database is reachable'));
              return { success: true, message: 'Database connectivity confirmed' };
            } catch (e) {
              console.log(chalk.red('  Database may be down or unreachable'));
              console.log(chalk.dim(`  Check status: fly status -a ${context.appName}-db`));
              return { success: false, message: 'Database connectivity issue' };
            }
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Verify DATABASE_URL environment variable is set correctly'));
            return { success: false, message: 'Manual verification required', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  1. Check database server is running'));
            console.log(chalk.dim('  2. Verify DATABASE_URL connection string'));
            console.log(chalk.dim('  3. Check firewall/network connectivity'));
            return { success: false, message: 'Manual verification required', manual: true };
          }
        }
      },

      'check_env': {
        description: 'Verify environment variables',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Listing Fly.io secrets (names only)...'));
            try {
              execSync(`fly secrets list -a ${context.appName}`, { stdio: 'inherit', timeout: 30000 });
              console.log(chalk.dim('\n  Verify all required secrets are set'));
              return { success: true, message: 'Secrets listed - verify required vars are present' };
            } catch (e) {
              return { success: false, message: 'Could not list secrets' };
            }
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Check Environment Variables in Vercel Dashboard'));
            return { success: false, message: 'Manual verification required', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Verify all required environment variables are set'));
            return { success: false, message: 'Manual verification required', manual: true };
          }
        }
      },

      'check_deps': {
        description: 'Check for missing dependencies',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Dependency issues usually require redeployment'));
            console.log(chalk.dim('  1. Check requirements.txt / package.json is complete'));
            console.log(chalk.dim('  2. Rebuild and redeploy: fly deploy'));
            return { success: false, message: 'Redeploy may be required', manual: true };
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Redeploy to reinstall dependencies'));
            return { success: false, message: 'Redeploy required', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Reinstall dependencies and redeploy'));
            return { success: false, message: 'Redeploy required', manual: true };
          }
        }
      }
    }
  },

  'slow_response': {
    name: 'Slow Response Time',
    symptoms: ['slow', 'timeout', 'took too long', '>5000ms', '>10000ms'],
    description: 'API responses are taking too long',

    diagnose: async (context) => {
      const diagnosis = {
        issue: 'slow_response',
        confidence: 0,
        details: [],
        suggestedFix: null
      };

      const responseTime = context.responseTime || 0;

      if (responseTime > 10000) {
        diagnosis.confidence = 90;
        diagnosis.details.push(`Response time ${responseTime}ms is critically slow (>10s)`);
        diagnosis.suggestedFix = 'scale_up';
      } else if (responseTime > 5000) {
        diagnosis.confidence = 80;
        diagnosis.details.push(`Response time ${responseTime}ms is slow (>5s)`);
        diagnosis.suggestedFix = 'optimize_or_scale';
      } else if (responseTime > 2000) {
        diagnosis.confidence = 60;
        diagnosis.details.push(`Response time ${responseTime}ms is higher than ideal (>2s)`);
        diagnosis.suggestedFix = 'optimize';
      }

      // Check if it might be cold start
      if (context.isFirstRequest) {
        diagnosis.details.push('This may be a cold start - subsequent requests should be faster');
        diagnosis.confidence = Math.max(diagnosis.confidence - 20, 30);
      }

      return diagnosis;
    },

    fixes: {
      'scale_up': {
        description: 'Scale up resources',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Scaling up Fly.io machine...'));
            try {
              // Scale both CPU and memory
              execSync(`fly scale vm shared-cpu-2x -a ${context.appName}`, { stdio: 'inherit', timeout: 60000 });
              return { success: true, message: 'Scaled to shared-cpu-2x' };
            } catch (e) {
              console.log(chalk.yellow('  Manual scaling options:'));
              console.log(chalk.dim(`  fly scale vm shared-cpu-2x -a ${context.appName}`));
              console.log(chalk.dim(`  fly scale memory 512 -a ${context.appName}`));
              return { success: false, message: 'Manual scaling required' };
            }
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Consider upgrading to Pro plan for better performance'));
            return { success: false, message: 'Plan upgrade may help', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Increase server resources (CPU/RAM)'));
            return { success: false, message: 'Manual scaling required', manual: true };
          }
        }
      },

      'optimize_or_scale': {
        description: 'Optimize or scale resources',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Performance recommendations:'));
            console.log(chalk.dim('  1. Check for N+1 queries in your code'));
            console.log(chalk.dim('  2. Add database indexes for slow queries'));
            console.log(chalk.dim('  3. Consider scaling: fly scale vm shared-cpu-2x'));
            console.log(chalk.dim('  4. Enable min_machines_running to avoid cold starts'));
            return { success: false, message: 'Optimization or scaling recommended', manual: true };
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Optimize function code or upgrade plan'));
            return { success: false, message: 'Optimization recommended', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Profile and optimize slow operations'));
            return { success: false, message: 'Optimization recommended', manual: true };
          }
        }
      },

      'optimize': {
        description: 'Optimize application performance',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.dim('  Consider query optimization and caching'));
            return { success: false, message: 'Optimization recommended', manual: true };
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Optimize function execution time'));
            return { success: false, message: 'Optimization recommended', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Profile and optimize slow operations'));
            return { success: false, message: 'Optimization recommended', manual: true };
          }
        }
      }
    }
  },

  'health_check_fail': {
    name: 'Health Check Failure',
    symptoms: ['health', '/health', '404 health', 'health check failed'],
    description: 'Health endpoint is not responding correctly',

    diagnose: async (context) => {
      const diagnosis = {
        issue: 'health_check_fail',
        confidence: 0,
        details: [],
        suggestedFix: null
      };

      if (context.response?.status === 404) {
        diagnosis.confidence = 90;
        diagnosis.details.push('Health endpoint returns 404 - endpoint may not exist');
        diagnosis.suggestedFix = 'add_health_endpoint';
      } else if (context.response?.status === 500) {
        diagnosis.confidence = 85;
        diagnosis.details.push('Health endpoint returns 500 - internal error');
        diagnosis.suggestedFix = 'fix_health_endpoint';
      } else if (!context.response) {
        diagnosis.confidence = 95;
        diagnosis.details.push('No response from health endpoint - server may be down');
        diagnosis.suggestedFix = 'check_server_status';
      }

      return diagnosis;
    },

    fixes: {
      'add_health_endpoint': {
        description: 'Add health check endpoint',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Health endpoint missing'));
            console.log(chalk.dim('  Add a /health or /api/health endpoint that returns 200 OK'));
            console.log(chalk.dim('  Example (FastAPI):'));
            console.log(chalk.dim(`
    @app.get("/health")
    async def health():
        return {"status": "ok"}
`));
            return { success: false, message: 'Add health endpoint to your app', manual: true };
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Add /api/health endpoint'));
            return { success: false, message: 'Add health endpoint', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Add /health endpoint to your application'));
            return { success: false, message: 'Add health endpoint', manual: true };
          }
        }
      },

      'check_server_status': {
        description: 'Check server status',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Checking Fly.io app status...'));
            try {
              execSync(`fly status -a ${context.appName}`, { stdio: 'inherit', timeout: 30000 });
              return { success: true, message: 'Status retrieved' };
            } catch (e) {
              return { success: false, message: 'Could not check status' };
            }
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Check Vercel deployment status in dashboard'));
            return { success: false, message: 'Check dashboard', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Verify server is running'));
            return { success: false, message: 'Manual check required', manual: true };
          }
        }
      },

      'fix_health_endpoint': {
        description: 'Fix health endpoint error',
        platforms: {
          'fly': async (context) => {
            console.log(chalk.cyan('\n  Health endpoint returning 500'));
            console.log(chalk.dim('  1. Check logs: fly logs -a ' + context.appName));
            console.log(chalk.dim('  2. Health endpoint should not depend on external services'));
            console.log(chalk.dim('  3. Return simple {"status": "ok"} without DB calls'));
            return { success: false, message: 'Fix health endpoint implementation', manual: true };
          },
          'vercel': async (context) => {
            console.log(chalk.dim('  Simplify health endpoint - remove external dependencies'));
            return { success: false, message: 'Fix implementation', manual: true };
          },
          'generic': async (context) => {
            console.log(chalk.dim('  Health endpoint should be lightweight'));
            return { success: false, message: 'Fix implementation', manual: true };
          }
        }
      }
    }
  }
};

/**
 * Detect the issue type based on error and response
 */
export function detectIssueType(error, response, context = {}) {
  const errorStr = String(error || '').toLowerCase();
  const status = response?.status;
  const responseBody = context.responseBody;
  const bodyStr = JSON.stringify(responseBody || {}).toLowerCase();

  // Check each known issue type
  for (const [issueType, issueDef] of Object.entries(KNOWN_FIXES)) {
    const matchedSymptoms = issueDef.symptoms.filter(symptom => {
      const s = symptom.toLowerCase();
      return errorStr.includes(s) || bodyStr.includes(s) || String(status) === s;
    });

    if (matchedSymptoms.length > 0) {
      return {
        type: issueType,
        matchedSymptoms,
        definition: issueDef
      };
    }
  }

  // Special case: Check status codes directly
  if (status === 403) {
    return {
      type: 'public_endpoint_403',
      matchedSymptoms: ['403'],
      definition: KNOWN_FIXES['public_endpoint_403']
    };
  }

  if (status === 500) {
    return {
      type: 'internal_server_error',
      matchedSymptoms: ['500'],
      definition: KNOWN_FIXES['internal_server_error']
    };
  }

  return null;
}

/**
 * Detect the platform from the URL or context
 */
export function detectPlatform(url, context = {}) {
  const urlStr = String(url || '').toLowerCase();

  if (urlStr.includes('.fly.dev') || urlStr.includes('.flycast') || context.platform === 'fly') {
    return 'fly';
  }

  if (urlStr.includes('.vercel.app') || urlStr.includes('.vercel.') || context.platform === 'vercel') {
    return 'vercel';
  }

  return 'generic';
}

/**
 * Extract app name from URL
 */
export function extractAppName(url) {
  const urlStr = String(url || '');

  // Fly.io: https://myapp.fly.dev -> myapp
  const flyMatch = urlStr.match(/https?:\/\/([^.]+)\.fly\.dev/);
  if (flyMatch) return flyMatch[1];

  // Vercel: https://myapp.vercel.app -> myapp
  const vercelMatch = urlStr.match(/https?:\/\/([^.]+)\.vercel\.app/);
  if (vercelMatch) return vercelMatch[1];

  // Try to extract from path
  const pathMatch = urlStr.match(/https?:\/\/([^/]+)/);
  if (pathMatch) return pathMatch[1].split('.')[0];

  return 'app';
}

/**
 * Main auto-fix function
 */
export async function autoFix(issue, context = {}) {
  console.log(chalk.bold.yellow('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.yellow('  🔧 AUTO-FIX DIAGNOSIS'));
  console.log(chalk.bold.yellow('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const issueDef = KNOWN_FIXES[issue.type];
  if (!issueDef) {
    console.log(chalk.red(`  Unknown issue type: ${issue.type}`));
    return { success: false, message: 'Unknown issue type' };
  }

  console.log(chalk.white(`  Issue: ${issueDef.name}`));
  console.log(chalk.dim(`  ${issueDef.description}\n`));

  // Run diagnosis
  console.log(chalk.cyan('  Running diagnosis...'));
  const diagnosis = await issueDef.diagnose(context);

  console.log(chalk.white(`\n  Confidence: ${getConfidenceLabel(diagnosis.confidence)}`));

  if (diagnosis.details.length > 0) {
    console.log(chalk.dim('  Details:'));
    diagnosis.details.forEach(d => console.log(chalk.dim(`    • ${d}`)));
  }

  if (!diagnosis.suggestedFix) {
    console.log(chalk.yellow('\n  Could not determine specific fix'));
    return { success: false, message: 'No fix identified', diagnosis };
  }

  // Get platform and app name
  const platform = detectPlatform(context.url, context);
  const appName = context.appName || extractAppName(context.url);

  console.log(chalk.dim(`\n  Platform: ${platform}`));
  console.log(chalk.dim(`  App: ${appName}`));

  // Get the fix
  const fix = issueDef.fixes[diagnosis.suggestedFix];
  if (!fix) {
    console.log(chalk.red(`\n  Fix "${diagnosis.suggestedFix}" not found`));
    return { success: false, message: 'Fix not implemented', diagnosis };
  }

  console.log(chalk.green(`\n  Suggested fix: ${fix.description}`));

  // Check if we should auto-apply
  if (context.autoApply === false) {
    console.log(chalk.yellow('\n  Auto-apply disabled. Run with --fix to apply.'));
    return { success: false, message: 'Fix identified but not applied', diagnosis, fix: diagnosis.suggestedFix };
  }

  // Apply the fix
  console.log(chalk.bold.cyan('\n  Applying fix...'));

  const platformFix = fix.platforms[platform] || fix.platforms['generic'];
  const result = await platformFix({ ...context, appName, platform });

  if (result.success) {
    console.log(chalk.bold.green(`\n  ✓ Fix applied: ${result.message}`));

    // Verify the fix
    if (context.verifyFix) {
      console.log(chalk.cyan('\n  Verifying fix...'));
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for deployment

      // The caller should handle verification
      return { success: true, message: result.message, diagnosis, needsVerification: true };
    }
  } else if (result.manual) {
    console.log(chalk.yellow(`\n  ⚠ Manual action required: ${result.message}`));
  } else {
    console.log(chalk.red(`\n  ✗ Fix failed: ${result.message}`));
  }

  return { ...result, diagnosis };
}

/**
 * Analyze multiple test failures and suggest fixes
 */
export async function analyzeFailures(failures, context = {}) {
  console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.cyan('  🔍 ANALYZING TEST FAILURES'));
  console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  const issues = [];
  const seenTypes = new Set();

  for (const failure of failures) {
    const issue = detectIssueType(
      failure.error || failure.details,
      { status: failure.status },
      { responseBody: failure.response }
    );

    if (issue && !seenTypes.has(issue.type)) {
      seenTypes.add(issue.type);
      issues.push({
        ...issue,
        failure
      });
    }
  }

  if (issues.length === 0) {
    console.log(chalk.yellow('  No known issues detected from failures'));
    console.log(chalk.dim('  The failures may require manual investigation'));
    return { issues: [], fixesApplied: 0 };
  }

  console.log(chalk.white(`  Found ${issues.length} potential issue(s):\n`));

  issues.forEach((issue, i) => {
    console.log(chalk.white(`  ${i + 1}. ${issue.definition.name}`));
    console.log(chalk.dim(`     Matched symptoms: ${issue.matchedSymptoms.join(', ')}`));
    if (issue.failure.endpoint) {
      console.log(chalk.dim(`     Endpoint: ${issue.failure.endpoint}`));
    }
  });

  // Apply fixes if auto-apply is enabled
  let fixesApplied = 0;

  if (context.autoApply) {
    console.log(chalk.bold.yellow('\n  Attempting automatic fixes...\n'));

    for (const issue of issues) {
      const result = await autoFix(issue, {
        ...context,
        error: issue.failure.error || issue.failure.details,
        response: { status: issue.failure.status },
        responseBody: issue.failure.response,
        endpoint: issue.failure.endpoint
      });

      if (result.success) {
        fixesApplied++;
      }
    }
  }

  return { issues, fixesApplied };
}

/**
 * Get a human-readable confidence label
 */
function getConfidenceLabel(confidence) {
  if (confidence >= 90) return chalk.green(`${confidence}% (High)`);
  if (confidence >= 70) return chalk.yellow(`${confidence}% (Medium)`);
  if (confidence >= 50) return chalk.yellow(`${confidence}% (Low)`);
  return chalk.red(`${confidence}% (Very Low)`);
}

/**
 * List all known fixes
 */
export function listKnownFixes() {
  console.log(chalk.bold.cyan('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.bold.cyan('  📋 KNOWN AUTO-FIXES'));
  console.log(chalk.bold.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

  for (const [type, def] of Object.entries(KNOWN_FIXES)) {
    console.log(chalk.bold.white(`  ${def.name}`));
    console.log(chalk.dim(`  Type: ${type}`));
    console.log(chalk.dim(`  Symptoms: ${def.symptoms.join(', ')}`));
    console.log(chalk.dim(`  Fixes:`));

    for (const [fixName, fix] of Object.entries(def.fixes)) {
      console.log(chalk.dim(`    • ${fixName}: ${fix.description}`));
    }
    console.log();
  }
}

export default {
  autoFix,
  detectIssueType,
  detectPlatform,
  extractAppName,
  analyzeFailures,
  listKnownFixes,
  KNOWN_FIXES
};
