import { catchError, ErrorManager } from '@svx/common';
import { OIDCUser, OIDCTicket, SessionManager } from '@svx/security';
import { OIDCAuthService } from '@svx/security-oidc';
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

@module({ parent: InfrastructureModule })
export class ApplicationModule extends Module {
  @create()
  createSessionManager(authService: OIDCAuthService): SessionManager<void, OIDCUser, OIDCTicket> {
    return new SessionManager(authService);
  }

  @create()
  createErrorManager(): ErrorManager {
    const manager = new ErrorManager();
    manager.registerHandler(this);
    return manager;
  }

  @create()
  createDeploymentLoader(): DeploymentLoader {
    return new RemoteDeploymentLoader([]);
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
    sessionManager: SessionManager<void, OIDCUser, OIDCTicket>,
    routerManager: RouterManager,
  ): Promise<void> {
    const session = await sessionManager.start();
    if (session) routerManager.navigateAfterLogin();
    routerManager.useSecurityGuard(sessionManager);
  }

  @catchError()
  handle(error: any) {
    console.log(error);
  }
}
