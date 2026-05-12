import 'reflect-metadata'

console.log("load servuce.json")
import reflection from './service.json';
TypeDescriptor.loadReflection(reflection as any);

import { ConsoleTrace, TraceLevel, Tracer, TypeDescriptor } from '@svx/common';

import {  Environment, module, onRunning, Module, injectable } from "@svx/di"

import { Component, ComponentDescriptor} from "@svx/service-common"
import { ComponentLocator, ServiceInstanceProvider} from "@svx/service-client"
console.log("load inventory servuce")
import { UserInventoryComponent, UserInventoryService } from './features/users/user-inventory.service';



const td = TypeDescriptor.forType(UserInventoryService as any); // TODO

console.log(td);

import { FeatureRegistry } from '@svx/portal';

import { mount } from 'svelte';

new Tracer({
      enabled: true,
      trace: new ConsoleTrace('%d [%p]: %m\n'), // %f
      paths: {
        di: TraceLevel.FULL,
        router: TraceLevel.FULL,
        portal: TraceLevel.FULL,
        application: TraceLevel.FULL
      }
});

// main module

@module()
class ApplicationModule extends Module {
  // lifecycle

  @onRunning()
  async setup() : Promise<void> {
    console.log("ApplicationModule.setup")
  }
}

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  // implement

  locate(_component: ComponentDescriptor<Component>): string {
    return "http://localhost:3000"
  }
}

// register providers for the service proxies

ServiceInstanceProvider.registerServiceProviders()

// start environment

const environment = new Environment({module: ApplicationModule})
await environment.start()

console.log(environment.report())

const service = environment.get<UserInventoryService>(UserInventoryService as any); //
const rr = await service.findAll()



// load local and remote manifests

const registry = environment.get(FeatureRegistry);

await registry.loadManifests(
  '/manifest.json',
  //'http://localhost:4201/manifest.json'
);

// force loading of local components

await registry.bootComponents(import.meta.glob('./features/**/*.svelte')); // maybe subfolder is better

// report

console.log(environment.report())

// mount app

import './main.css';


const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: {
    environment
  }
});
