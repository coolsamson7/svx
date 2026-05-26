import { catchError, ErrorManager } from '@svx/common';
import { SessionManager } from '@svx/security';
import { OIDCAuthService, OIDCSettings } from '@svx/security-oidc';
import { UsernamePasswordAuthentication, UsernamePasswordRequest } from '@svx/security-credentials';
import { ServiceClient } from '@svx/service-client';
import {
  DeploymentLoader,
  DeploymentManager,
  FeatureRegistry,
  ManifestProcessor,
  RemoteDeploymentLoader,
  RouterManager,
} from '@svx/portal';
import { Module, create, module, onRunning } from '@svx/di';
import { InfrastructureModule } from './infrastructure.module';
import manifest from '../manifest.json';

const authModeFromUrl = new URLSearchParams(window.location.search).get('auth');
if (authModeFromUrl) sessionStorage.setItem('svx:auth-mode', authModeFromUrl);
const authMode = sessionStorage.getItem('svx:auth-mode') ?? 'oidc';

@module({ parent: InfrastructureModule })
export class ApplicationModule extends Module {
  @create()
  createSessionManager(oidcAuth: OIDCAuthService): SessionManager<any> {
    if (authMode === 'credentials') {
      const auth = new UsernamePasswordAuthentication(async (username, password) => {
        if (username === 'admin' && password === 'admin') {
          return {
            user: {
              sub:                '1',
              name:               'Admin User',
              preferred_username: 'admin',
              email:              'admin@example.com',
              roles:              ['users:read'],
            },
            ticket:        { accessToken: 'mock-token' },
            sessionLocals: {},
          };
        }
        throw new Error(`Login failed for user: ${username}`);
      });
      return new SessionManager(auth);
    }

    return new SessionManager(oidcAuth);
  }

  @create()
  createErrorManager(): ErrorManager {
    const manager = new ErrorManager();
    manager.registerHandler(this);
    return manager;
  }

  @create()
  createDeploymentLoader(): DeploymentLoader {
    return new RemoteDeploymentLoader([{
      name: 'remote',
      url: `http://localhost:4201`,
    }]);
  }

  @create()
  createDeploymentManager(
    loader: DeploymentLoader,
    featureRegistry: FeatureRegistry,
  ): DeploymentManager {
    return new DeploymentManager({
      featureRegistry,
      loader,
      localManifest: manifest as never,
      processor: new ManifestProcessor({
        hasPermission: () => true,
        hasFeature:    () => true,
      }),
    });
  }

  @onRunning()
  async setup(
    sessionManager: SessionManager<any>,
    routerManager: RouterManager,
    oidcAuth: OIDCAuthService,
    serviceClient: ServiceClient,
  ): Promise<void> {
    if (authMode === 'oidc') {
      serviceClient.setTokenProvider({ getToken: () => oidcAuth.getToken() });
    }
    routerManager.useSecurityGuard(sessionManager, authMode === 'credentials');
    const session = await sessionManager.start();
    if (session) routerManager.navigateAfterLogin();
    await routerManager.runGuardForCurrentPath();
  }

  @catchError()
  handle(error: any) {
    console.log(error);
  }
}
