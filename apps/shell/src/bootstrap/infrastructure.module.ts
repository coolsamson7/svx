import { ConfigurationManager, ValueConfigurationSource } from '@svx/common';
import { Module, create, module, onRunning } from '@svx/di';

@module({ name: 'infrastructure' })
export class InfrastructureModule extends Module {
  @create()
  createConfigurationManager(): ConfigurationManager {
    return new ConfigurationManager(new ValueConfigurationSource({
      authentication: {
        url:      import.meta.env.VITE_KEYCLOAK_URL,
        realm:    import.meta.env.VITE_KEYCLOAK_REALM,
        clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
      },
    }));
  }

  @onRunning()
  async startup(configurationManager: ConfigurationManager) {
    await configurationManager.load();
  }
}
