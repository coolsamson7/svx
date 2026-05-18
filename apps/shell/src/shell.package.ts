import pkg from '../package.json'
import { DeclareApplication, AbstractPackage } from '@svx/common'

@DeclareApplication({ name: pkg.name, version: pkg.version })
export class ShellPackage extends AbstractPackage {}
