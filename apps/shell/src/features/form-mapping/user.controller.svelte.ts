import type { User } from './user.model';
import { UserService } from './user.service';
import { AbstractController, Command, WithCommands, type Environment } from '@svx/portal';

const inject = <T>(env: Environment, type: new (...args: any[]) => T): T => {
  return env.get(type) as T;
};

export class UserController extends WithCommands(AbstractController) {
  user: User = { id: 0, name: '' }//$state({ id: 0, name: '' });
  loading = false//$state(false);

  private service: UserService;

  constructor(environment: Environment) {
    super(environment)

    this.service = inject(environment, UserService);
  }

  @Command({label: "Load"})
  async load() {
    this.loading = true;
    const existing = await this.service.load();
    this.user = existing ?? { id: 0, name: '' };
    this.loading = false;
  }

  @Command({label: "Save"})
  async save() {
    await this.service.save(this.user);
  }
}