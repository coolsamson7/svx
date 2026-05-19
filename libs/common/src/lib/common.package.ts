import pkg from '../../package.json'
import { DeclareLibrary } from './packages/declare-library.decorator'
import { AbstractPackage } from './packages/abstract-package'

@DeclareLibrary(pkg)
export class CommonPackage extends AbstractPackage {}
