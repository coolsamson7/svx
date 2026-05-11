import { Environment, injectable } from "@svx/di";
import { GType , TypeDescriptor, TraceLevel, Tracer, registerMixins} from "@svx/common";

export type LockType = "command" | "group" | "view"

export interface CommandConfig {
    /**
     * the command name
     */
    command?: string;
     /**
     * the - optional - group of the commands that may be disabled
     */
    group?: string;
    /**
     * the label of the command
     */
    label?: string;
    /**
     * the - optional - i18n key that will be used to compute the label
     */
    i18n?: string;
    /**
     * the - optional - shortcut of the command
     */
    shortcut?: string;
     /**
     * the - optional - tooltip of the command
     */
     tooltip?: string;
    /**
     * the - optional - icon name of the command
     */
    icon?: string;
    /**
     * the enabled status of the command.
     */
    enabled?: boolean;
    /**
     * the - optional - lock configuration of the command
     */
    lock?: LockType;

    action?: (args: any) => Promise<any> | any;

    speech?: string;

    // additional args

    [prop : string] : any;
}

export function Command(config: CommandConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    TypeDescriptor.forType(target.constructor).addMethodDecorator(target, propertyKey, Command, config)

    if (!config.command) config.command = propertyKey;

    config.action = descriptor.value;
  };
}


/**
 * A <code>CommandInterceptor</code> is part of a chain of interceptors and can add execution logic as part of a command execution.
 */
export interface CommandInterceptor {
    /**
     * called prior to method execution
     * @param executionContext  {@link ExecutionContext} the current execution context
     */
    onCall(executionContext: ExecutionContext): void;
    /**
     * called after a result has been computed
     * @param executionContext  {@link ExecutionContext} the current execution context
     */
    onResult(executionContext: ExecutionContext): void;
    /**
     * called after an exception has been caught
     * @param executionContext  {@link ExecutionContext} the current execution context
     */
    onError(executionContext: ExecutionContext): void;
  }
  
  /**
   * an abstract base class for interceptors. All methods are empty.
   */
  export class AbstractCommandInterceptor implements CommandInterceptor {
    // implement CommandInterceptor
  
    /**
     * @inheritdoc
     */
    onCall(executionContext: ExecutionContext): void {}
  
    /**
     * @inheritdoc
     */
    onError(executionContext: ExecutionContext): void {}
  
    /**
     * @inheritdoc
     */
    onResult(executionContext: ExecutionContext): void {}
  }


export interface CommandManager {
    findCommand(command: string) : CommandDescriptor | undefined

    runCommand<T = any>(commandName: string, ...args: any[]): T

    callSuper<T=any>(...args: any[]) : T

    createdCommand(command: CommandDescriptor) : void

    getCommand(command: string): CommandDescriptor

    setCommandEnabled(command: string, value: boolean): CommandManager

    addCommandInterceptors(commandConfig: CommandConfig, interceptors:  CommandInterceptor[]) : void
}

/**
 * a <code>CommandFilter</code> controls, what commands are returned by the method getCommands
 */
export interface CommandFilter {
    /**
     * if <code>true</code> inherited commands are returned as well
     */
    inherited?: boolean;
    /**
     * an optional group of commands
     */
    group?: string;
  }


export interface CommandAdministration extends CommandManager {
    getCommands(filter: CommandFilter): CommandDescriptor[]

    currentExecutionContext?: ExecutionContext;

    pendingExecutions(): boolean

    pushExecutionContext(context: ExecutionContext): void

    popExecutionContext(context: ExecutionContext): void
}

export class ExecutionContext {
    // instance data
  
    running = false
    result: any = undefined
    error: any = undefined
    data : any  = {}
  
    // constructor
  
    constructor(public command: CommandDescriptor, public commands: CommandAdministration, public args: any[]) {}
  }
  


/**
 * a <code>CommandListener</code> can be used in order to be informed about success or failure of a command execution.
 */
export interface CommandListener {
   /**
     * called when the command is called
     * @param command the command
     * @param args the arguments
     */
    onCall(context: ExecutionContext) : void

    /**
     * called when the command has returned a value
     * @param context the context
     */
    onResult(context: ExecutionContext) : void

    /**
     * called when the command has returned an error
     * @param context the context
     */
    onError(context: ExecutionContext) : void

    onStateChange(state: boolean) : void
}

export class CommandDescriptor {
    // instance data

    name: string
    group?: string;
    label?: string;
    tooltip?: string;
    shortcut?: string;
    icon?: string;


    private _enabled = true;

get enabled(): boolean {
  return this._enabled;
}

set enabled(value: boolean) {
  if (this._enabled === value) return;

  this._enabled = value;

  this.onStateChange(value)
}

    i18n?: string;
    speech?: string;
    // i don't like this coupling...isn't there a better idea?
    shortcutSubscription? : () => void
    speechSubscription? : () => void

    commands: CommandAdministration; // the declaring container

    superCommand?: CommandDescriptor;
    interceptors: CommandInterceptor[] = [];
    listeners: CommandListener[] = [];

    // constructor

    constructor(commands: CommandAdministration, config: CommandConfig) {
      this.commands = commands
      this.name = config.command!;
      this.group = config.group;
      this.icon = config.icon;
      this.label = config.label ? config.label : config.command;
      this.tooltip = config.tooltip;
      this.shortcut = config.shortcut;
      this.enabled = config.enabled ? config.enabled : true;
      this.i18n = config.i18n;
      this.speech = config.speech;
    }

    // public

    removeListener(listener: CommandListener) {
      if (!this.listeners) return;

      const index = this.listeners.indexOf(listener);
      if (index !== -1)
        this.listeners.splice(index, 1);
    }

    addListener(listener: CommandListener) {
      if (!this.listeners)
         this.listeners = [listener];
      else
         this.listeners.push(listener);
    }

    onStateChange(state: boolean) {
      if (Tracer.ENABLED) Tracer.Trace('command', TraceLevel.FULL, 'command.enabled = {0}', state);

      if (this.listeners)
        for (const listener of this.listeners)
          listener.onStateChange(state);
    }

    onCall(context: ExecutionContext) {
      if (Tracer.ENABLED) Tracer.Trace('command', TraceLevel.FULL, 'command on call {0}', context.command.name);

      if (this.listeners)
        for (const listener of this.listeners)
          listener.onCall(context);
    }

    onResult(context: ExecutionContext): void {
      if (Tracer.ENABLED) Tracer.Trace('command', TraceLevel.FULL, 'command on result {0}', context.result);

      if (this.listeners)
        for (const listener of this.listeners)
          listener.onResult(context);
    }

    onError(context: ExecutionContext): void {
      if (Tracer.ENABLED) Tracer.Trace('command', TraceLevel.FULL, 'command on error {0}', context.error);

      if (this.listeners)
        for (const listener of this.listeners)
          listener.onError(context);
    }

    createContext(args: any[], data?: any) :ExecutionContext{
      const context = new ExecutionContext(this, this.commands, args);

      if ( data )
         context.data = data

      return context
    }

    runWithContext(context: ExecutionContext) : Promise<any> {
       // listener

       this.onCall(context)

       // run the "onCall" pipeline, the last interceptor is the function call

       let index = 0;

       try {
         for (; index < this.interceptors.length; index++)
             this.interceptors[index].onCall(context);
       }
       catch (error) {
         context.error = error;

         // run the "onError" pipeline in reverse order

         while (index >= 0)
             this.interceptors[index--].onError(context);

         // call listeners

         this.onError(context);

         return Promise.reject(error);
       }

       // now we have an object or a promise...

       index = this.interceptors.length - 1;

       return Promise.resolve(context.result) // start with the initial result
         .then((result) => {
           context.result = result;

           // run the "onResult" pipeline in reverse order

           while (index >= 0)
            this.interceptors[index--].onResult(context);

           // call listeners

           this.onResult(context);

           return context.result;
         })
         .catch((error) => {
           context.error = error;

           // run the "onError" pipeline in reverse order

           while (index >= 0) this.interceptors[index--].onError(context);

           // call listeners

           this.onError(context);
         });
    }

    /**
     * run the command by executing all interceptors.
     * @param args the command arguments
     */
    run(...args: any[]): Promise<any> {
      if (Tracer.ENABLED) Tracer.Trace('command', TraceLevel.FULL, 'run command {0}', this.name);

      return this.runWithContext(this.createContext(args))
    }
}

// factory

export class CommandContextInterceptor implements CommandInterceptor {
  // implement CommandInterceptor

  /**
   * @inheritdoc
   */
  onCall(executionContext: ExecutionContext): void {
    executionContext.running = true;

    executionContext.commands.pushExecutionContext(executionContext);
  }

  /**
   * @inheritdoc
   */
  onResult(executionContext: ExecutionContext): void {
    executionContext.running = false;

    executionContext.commands.popExecutionContext(executionContext);
  }

  /**
   * @inheritdoc
   */
  onError(executionContext: ExecutionContext): void {
    executionContext.running = false;

    executionContext.commands.popExecutionContext(executionContext);
  }
}

/**
 * this is an internal interceptor that will call the command method
 */
export class CommandCallFunctionInterceptor extends AbstractCommandInterceptor {
    // constructor

    constructor(private call: Function) {
      super();
    }

    // implement CommandInterceptor

    /**
     * @inheritdoc
     */
    override onCall(context: ExecutionContext) {
      const previousContext = context.commands.currentExecutionContext;
      context.commands.currentExecutionContext = context;

      try {
        context.result = this.call.apply(context.commands, context.args);
      }
      finally {
        context.commands.currentExecutionContext = previousContext;
      }
    }
  }


/**
 * A <code>CommandFactory</code> is used to create a {@link Command} given a configuration object.
 * It will create all necessary interceptors based on the central configuration and the corresponding controller.
 */
@injectable()
export class CommandFactory {
  // instance data

  private interceptors: CommandInterceptor[]

  // constructor

  constructor(private injector: Environment) {
    this.interceptors = [
        new CommandContextInterceptor(),
        //TODO...injector.get(CommandConfigToken, {  interceptors: [] }, InjectFlags.Optional) .interceptors.map(type => this.injector.get(type))
    ]
  }

  // public

  /**
   * create a {@link Command}
   * @param commandConfig the command config
   * @param controller the controller
   */
  public createCommand(commandConfig: CommandConfig, commands: CommandAdministration): CommandDescriptor {
    if (Tracer.ENABLED)
      Tracer.Trace('commands', TraceLevel.HIGH, 'create command {0}', commandConfig.command);

    // create command

    const command = new CommandDescriptor(commands, commandConfig);

    // set some data

    command.commands = commands;

    // set static interceptors

    command.interceptors.push(...this.interceptors);

    // add command interceptors from manager

    commands.addCommandInterceptors(commandConfig, command.interceptors);

    // add method call

    command.interceptors.push(new CommandCallFunctionInterceptor(commandConfig.action  as Function));

    // done

    return command;
  }
}


type Constructor<T = any> =  new (...args: any[]) => T;

interface CommandData extends CommandConfig {
   method: string
}

export interface WithCommandsConfig {
    inheritCommands: boolean
}

export class AbstractController {
    constructor(protected environment: Environment) {}
}


export function WithCommands<T extends Constructor<AbstractController>>(base: T, config: WithCommandsConfig = {inheritCommands: false} ) :Constructor<CommandManager /*& OnLocaleChange*/> &  T  {
    class WithCommandsClass extends base implements CommandAdministration/*, OnLocaleChange*/ {
        // instance data

        private commands: { [key: string]: CommandDescriptor } = {};
        private pending: ExecutionContext[] = [];
        //private translator: Translator
        currentExecutionContext?: ExecutionContext;

        // constructor

        constructor(...args: any[]) {
            super(...args);

            const environment : Environment = args[0]

            //this.onDestroy(inject(LocaleManager).subscribe(this))

            //this.translator = inject(Translator)

            this.collectCommands(environment.get(CommandFactory))
        }

        updateCommandState() {}

        /* implement OnLocaleChange

        onLocaleChange(locale: Intl.Locale): Observable<any> {
            for ( const commandName in this.commands) {
                const command = this.commands[commandName]

                // possibly unsubscribe shortcut

                if ( command.shortcutSubscription ) {
                    command.shortcutSubscription()
                    command.shortcutSubscription = undefined
                }

                if ( command.i18n) {
                    this.addI18N(command)

                    // check shortcut again

                    if (command.shortcut)
                        this.registerShortcut(command)
               } // if
            }

            return of()
        }*/

        // private

        private parentCommandManager() : WithCommandsClass | undefined {
            /*let parent = this.parent
            while ( parent ) {
               if ( parent instanceof WithCommandsClass)
                  return parent as WithCommandsClass

                  parent = parent.parent
            }*/

            return undefined
        }

        // implement CommandAdministration

        /**
         * Find a command by name and execute it with provided arguments.
         * @param commandName the name of the command
         * @param args arguments to pass to the command
         * @returns the result of command.run(...)
         */
        runCommand<T = any>(commandName: string, ...args: any[]): T {
            const command = this.getCommand(commandName); // throws if not found
            const context = command.createContext(args, { fromCode: true });

            this.currentExecutionContext = context;
            try {
                const result = command.runWithContext(context) as T;
                return result;
            } finally {
                this.currentExecutionContext = undefined;
            }
        }

         /**
         * return an array commands, given a filter object
         * @param filter a <code>CommandFilter</code>
         * @see CommandFilter
         */
        getCommands(filter: CommandFilter = {}): CommandDescriptor[] {
            const commands: { [key: string]: CommandDescriptor } = {};

            const collect = (controller: WithCommandsClass) => {
                // recursion

                if (filter.inherited && controller.parentCommandManager())
                    collect(controller.parentCommandManager()!);

                // add commands

                for (const commandName in controller.commands) {
                    const command = controller.commands[commandName];

                    if (filter.group) {
                      if (command.group == filter.group)
                        commands[commandName] = command; // will overwrite in cases of overridden commands
                    }
                    else  commands[commandName] = command;
                }
            };

            // collect everything

            collect(this);

            // done

            return Object.values(commands);
        }

        // implement Commands

        pendingExecutions(): boolean {
            return this.pending.length > 0;
        }

        pushExecutionContext(context: ExecutionContext): void {
            this.pending.push(context);
        }

        popExecutionContext(context: ExecutionContext): void {
            this.pending.splice(this.pending.indexOf(context), 1);
        }

        callSuper<T=any>(...args: any[]) : T {
            if (this.currentExecutionContext) {
                const currentCommand = this.currentExecutionContext.command

                if (currentCommand.superCommand)
                    return currentCommand.superCommand.run(args) as T;
                else
                    throw new Error(`no super command '${currentCommand.name}'`);
            }
            else throw new Error("no current command execution");
        }

        findCommand(commandName: string): CommandDescriptor | undefined {
            const command = this.commands[commandName];

            if ( command )
                return command
            else {
                const parent = this.parentCommandManager()
                if (config.inheritCommands && parent)
                    return parent.findCommand(commandName)
            }

             return undefined;
        }

        getCommand(commandName: string): CommandDescriptor {
            const command = this.commands[commandName];

            if ( command )
                return command;
            else {
                const parent = this.parentCommandManager()
                if (config.inheritCommands && parent)
                    return parent.getCommand(commandName)
                else
                    throw new Error(`no command '${commandName}'`)
            }
        }

        setCommandEnabled(command: string, value: boolean): CommandManager {
            if (Tracer.ENABLED)
                Tracer.Trace('command', TraceLevel.HIGH, 'command {0}.enabled = {1}', command, value);

            this.getCommand(command).enabled = value;

            return this as CommandManager;
        }

        addCommandInterceptors(commandConfig: CommandConfig, interceptors: CommandInterceptor[]) : void {
            // noop
        }

        createdCommand(command: CommandDescriptor) : void {
            // noop
        }

        // private

        private registerShortcut(command: CommandDescriptor) {/*
            command.shortcutSubscription = this.inject(ShortcutManager).register({
                shortcut: command.shortcut!,
                onShortcut: () => {
                  return command.runWithContext(command.createContext([], {fromShortcut: true}));
                }
              })

            // delete on destroy

            if (!command.shortcutSubscription)
                this.onDestroy(() => {if (command.shortcutSubscription)  command.shortcutSubscription!()});*/
        }

        private addI18N(commandConfig: CommandConfig) {
            const colon = commandConfig.i18n!.indexOf(":")
            const namespace = commandConfig.i18n!.substring(0, colon)
            const prefix = commandConfig.i18n!.substring(colon + 1)

            /*let translations = this.translator.findTranslationsFor(namespace)

            if ( translations ) {
                if ( prefix.indexOf(".") > 0)
                    commandConfig.label = get(translations, prefix)
                else {
                    translations = translations[prefix]

                    if ( translations ) {
                        // set new values

                        Object.getOwnPropertyNames(translations).forEach(name => {
                            switch (name) {
                                case "label":
                                case "tooltip":
                                case "shortcut":
                                case "speech":
                                    (<any>commandConfig)[name] = translations[name]
                                break;

                                default:
                            } // switch
                    })
                    }
                } // else
            }*/
        }

        private addCommand(commandFactory: CommandFactory, commandConfig: CommandConfig) {
            if ( commandConfig.i18n)
               this.addI18N(commandConfig)

            // go

            const inheritedCommand = this.findCommand(commandConfig.command!);

            // create by factory

            const command = commandFactory.createCommand(commandConfig, this as CommandAdministration);

            if (inheritedCommand)
                command.superCommand = inheritedCommand;

            // and register

            this.commands[commandConfig.command!] = command;

            // callback

            this.createdCommand(command)

            // shortcut needed?

            if (command.shortcut)
                this.registerShortcut(command);

            // done

            return command;
        }

        private collectCommands(commandFactory: CommandFactory): void {
            const type = TypeDescriptor.forType(this.constructor as GType<any>)

            const configs: { [type: string]: CommandData } = {};


            // local function that collects commands from all superclasses and additionally
            // takes care of inherited methods by replacing the appropriate functions in the command config

            const collect = (clazz?: TypeDescriptor<any>) => {
              if (clazz) {
                // recursion

                //TODO collect(clazz.superClass);

                // check overridden methods

                for (const config of Object.values(configs)) {
                    const name = config.command!;

                    const method = clazz.getMethod(name); // TODO OWN
                    if (method)
                        config.action = method.method as (args: any) => Promise<any> | any; // replace function with inherited
                }

                // check decorators bottom up

              for (const method of clazz.getMethods(method => method.hasDecorator(Command))) {
                const command : CommandData = method.getDecorator(Command)?.arguments[0]

                command.command ??= method.name
                command.method = method.name

                if (configs[command.command!])
                    // a decorator overrides a parent decorator
                    Object.assign(configs[command.command!], command);
                    // leave inherited properties
                else
                    configs[command.command!] = command;
               } // for
              }
            }

            // collect all decorated command configs

            collect(type);

            // add as commands

            for (const config of Object.values(configs)) {
              if (Tracer.ENABLED)
                Tracer.Trace('command', TraceLevel.HIGH, 'add command {0}', config.command);

              const commandInstance = this.addCommand(commandFactory, config);

              // replace the function :-)

             (<any>this)[config.method!] = (...args: any[]) => commandInstance.run(...args);
            }
          }
    }//, WithCommands)

    return registerMixins(WithCommandsClass, WithCommands)
  }