import 'reflect-metadata';

import {
  Environment,
  injectable,
  onInit,
  onRunning,
  onDestroy,
  inject,
  create,
  config,
  module,
  Module,

} from './index';

import { ConfigurationManager, ValueConfigurationSource, ConsoleTrace, TraceLevel, Tracer  } from '@svx/common';


 new Tracer({
      enabled: true,
      trace: new ConsoleTrace('%d [%p]: %m\n'), // %f
      paths: {
        aop: TraceLevel.OFF,
        di: TraceLevel.OFF,
        application: TraceLevel.OFF,
        form: TraceLevel.OFF,
      },
});

// module for testing

@module({
  name: "parent",
  imports: []
})
class ParentModule extends Module {
  configurationManager! : ConfigurationManager;

  constructor() {
    super();
  }

  @create()
  createConfigurationManager() : ConfigurationManager {
    return this.configurationManager = new ConfigurationManager(
      new ValueConfigurationSource({
        "foo": {
          "bar": "foo.bar"
        }
      })
    )
  }

  @onRunning()
  async setup() : Promise<void> {
    await this.configurationManager.load();
  }
}

@module({
  name: "imported",
  imports: []
})
class ImportedModule extends Module {
}

// some classes

class Base {
    @inject()
    injectEnvironment(environment: Environment) {
        // console.log("kk", environment);
    }

    @onRunning()
    running() {
        // console.log("runn");
    }
}

@injectable()
class Bar extends Base {
  running() {
    super.running()
  }

  @onRunning()
  running1() {
      //console.log("runn");
  }
}

//@injectable()
class Baz {
}

@injectable({scope: "request"})
class RequestFoo {
}

@injectable()
class Foo {
    static instances = 0;

    constructor(public bar: Bar, @config("foo.bar") public value: string) {
        Foo.instances++;
    }
}

@injectable({scope: "environment"})
class EnvironmentFoo {
    static instances = 0;

    constructor() {
        EnvironmentFoo.instances++;
    }
}

// no name, it will pickup the rest

@injectable()
class ModuleState {
  addError(error: string)  {
    this.errors.push(error);
  }

  errors : string[] = []

  injectCalled = false;
  initCalled = false;
  runningCalled = false;
  destroyCalled = false;
  asyncRunningCalled = false;
  asyncDestroyCalled = false;
}

@module({
  name: "child",
  imports: []
})
class ChildModule extends Module {}

@injectable({module: "child"})
class ChildFoo {}

@module({
  imports: [ImportedModule]
})
class TestModule extends Module {
    // factory

    @create() createBaz(): Baz {
        return new Baz();
    }

    // lifecycles

    @inject()
    injectEnvironment(environment: Environment, state: ModuleState) {
        if (!environment) state.addError("Environment not injected");

        state.injectCalled = true;
    }

    @onInit()
    init(state: ModuleState) {
        state.initCalled = true;
    }

    @onRunning()
    running(state: ModuleState) {
         state.runningCalled = true;
    }

    @onDestroy()
    destroy(state: ModuleState) {
        state.destroyCalled = true;
    }

    @onRunning()
    async asyncRunning(state: ModuleState) {
         state.asyncRunningCalled = true;
    }

    @onDestroy()
    async asyncDestroy(state: ModuleState) {
        state.asyncDestroyCalled = true;
    }
}

// test suite

const createEnvironment = async () => {
   const parentEnvironment = new Environment({module: ParentModule});

   await parentEnvironment.start();

   //console.log(parentEnvironment.report());

    const environment = new Environment({module: TestModule, parent: parentEnvironment});

    await environment.start();

    return environment;
}


describe('Dependency Injection', () => {
  let environment : Environment;

  // lifecycle

  beforeEach(async () => {
     environment = await createEnvironment();
  });

  afterEach(async () => {
     await environment.stop();
  });

  // tests

  it('should support scopes', () => {
      // singleton

      const foo1 = environment.get(Foo);
      const foo2 = environment.get(Foo);

      expect(foo1).toBe(foo2); // should be identical

      // request

      const requestFoo = environment.get(RequestFoo);
      const requestFoo1 = environment.get(RequestFoo);

      expect(requestFoo).not.toBe(requestFoo1); // shou
  });

  it('should support constructor injection', () => {
    const foo = environment.get(Foo);

    expect(foo.bar).toBeDefined();
  });

  it('should support factories', () => {
    const baz = environment.get(Baz);

    expect(baz).toBeDefined();
  });

  it('should support lifecycle methods', () => {
      // singleton

      const state = environment.get(ModuleState);

      expect(state.errors.length).toBe(0);
      expect(state.injectCalled).toBe(true);
      expect(state.initCalled).toBe(true);
      expect(state.runningCalled).toBe(true);
      expect(state.asyncRunningCalled).toBe(true);

      //expect(state.destroyCalled).toBe(false);
      //expect(state.asyncDestroyCalled).toBe(false);
  });

  it('should support inherited environments', () => {
    //console.log(environment.report());

    const foo = environment.get<Foo>(Foo);
    const environmentFoo = environment.get(EnvironmentFoo);

    const childEnvironment = new Environment({module: ChildModule, parent: environment});

    //console.log(childEnvironment.report())

    const childFoo = childEnvironment.get(Foo);
    const childEnvironmentFoo = childEnvironment.get(EnvironmentFoo);

    expect(foo).toBe(childFoo); // should be identical
    expect(environmentFoo).not.toBe(childEnvironmentFoo);
  });
});
